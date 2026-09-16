#!/usr/bin/env bash
# monitoring.sh — the detection the old host lacked for three weeks.
#
#   SNS topic + e-mail subscription (confirm the e-mail once)
#   CloudWatch alarms on the prod instance: CPU, network egress, status checks
#   CloudTrail trail (management events everywhere + S3 data events on the media
#   and forensic buckets) into a locked log bucket — previously NO trail existed,
#   which is why S3 object access during the incident cannot be reconstructed
#   GuardDuty in ap-south-1 (crypto-mining, C2 beaconing and IMDS-credential-
#   exfiltration findings are exactly this incident's shape)
#
# Usage: monitoring.sh <instance-id> [alert-email]
set -Eeuo pipefail
export AWS_PAGER=""
REGION=ap-south-1; ACCOUNT=976134557584
IID="${1:?usage: monitoring.sh <instance-id> [alert-email]}"
EMAIL="${2:-dev@metnmat.com}"
say() { printf '\n== %s ==\n' "$*"; }

say "SNS topic metnmat-alerts → $EMAIL"
TOPIC=$(aws sns create-topic --region $REGION --name metnmat-alerts --query TopicArn --output text)
aws sns list-subscriptions-by-topic --region $REGION --topic-arn "$TOPIC" --query "Subscriptions[?Endpoint=='$EMAIL'].SubscriptionArn" --output text | grep -q . \
  || aws sns subscribe --region $REGION --topic-arn "$TOPIC" --protocol email --notification-endpoint "$EMAIL" >/dev/null
echo "$TOPIC (confirm the subscription e-mail)"

say "CloudWatch alarms on $IID"
alarm() { # name metric stat threshold comparison periods period [unit]
  aws cloudwatch put-metric-alarm --region $REGION --alarm-name "metnmat-prod-$1" --namespace AWS/EC2 \
    --dimensions Name=InstanceId,Value="$IID" --metric-name "$2" --statistic "$3" --threshold "$4" \
    --comparison-operator "$5" --evaluation-periods "$6" --period "$7" --treat-missing-data notBreaching \
    --alarm-actions "$TOPIC" --ok-actions "$TOPIC" --alarm-description "$8"
  echo "  metnmat-prod-$1"
}
alarm cpu-high        CPUUtilization    Average 80         GreaterThanThreshold 3 300 "CPU > 80% for 15 min — the miner/botnet signature"
alarm egress-high     NetworkOut        Sum     3000000000 GreaterThanThreshold 1 3600 "> 3 GB out in an hour — scanning/DDoS signature (normal day is < 1 GB)"
alarm status-failed   StatusCheckFailed Maximum 0          GreaterThanThreshold 2 60  "instance or system status check failing"
alarm cpu-credit-low  CPUCreditBalance  Minimum 50         LessThanThreshold    2 300 "t3 CPU credits nearly exhausted"

say "CloudTrail (management + S3 data events)"
LOGB=metnmat-cloudtrail-$ACCOUNT
if ! aws s3api head-bucket --bucket $LOGB 2>/dev/null; then
  aws s3api create-bucket --bucket $LOGB --region $REGION --create-bucket-configuration LocationConstraint=$REGION --object-ownership BucketOwnerEnforced >/dev/null
  aws s3api put-public-access-block --bucket $LOGB --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
  aws s3api put-bucket-encryption --bucket $LOGB --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
  aws s3api put-bucket-lifecycle-configuration --bucket $LOGB --lifecycle-configuration '{"Rules":[{"ID":"expire-400d","Status":"Enabled","Filter":{"Prefix":""},"Expiration":{"Days":400}}]}'
  cat > /tmp/ct-bucket-policy.json <<EOF
{"Version":"2012-10-17","Statement":[
 {"Sid":"AclCheck","Effect":"Allow","Principal":{"Service":"cloudtrail.amazonaws.com"},"Action":"s3:GetBucketAcl","Resource":"arn:aws:s3:::$LOGB",
  "Condition":{"StringEquals":{"aws:SourceArn":"arn:aws:cloudtrail:$REGION:$ACCOUNT:trail/metnmat-trail"}}},
 {"Sid":"Write","Effect":"Allow","Principal":{"Service":"cloudtrail.amazonaws.com"},"Action":"s3:PutObject","Resource":"arn:aws:s3:::$LOGB/AWSLogs/$ACCOUNT/*",
  "Condition":{"StringEquals":{"s3:x-amz-acl":"bucket-owner-full-control","aws:SourceArn":"arn:aws:cloudtrail:$REGION:$ACCOUNT:trail/metnmat-trail"}}}]}
EOF
  aws s3api put-bucket-policy --bucket $LOGB --policy file:///tmp/ct-bucket-policy.json
fi
aws cloudtrail get-trail --region $REGION --name metnmat-trail >/dev/null 2>&1 \
  || aws cloudtrail create-trail --region $REGION --name metnmat-trail --s3-bucket-name $LOGB --is-multi-region-trail --enable-log-file-validation >/dev/null
aws cloudtrail put-event-selectors --region $REGION --trail-name metnmat-trail --advanced-event-selectors '[
  {"Name":"management","FieldSelectors":[{"Field":"eventCategory","Equals":["Management"]}]},
  {"Name":"s3-media-and-forensics","FieldSelectors":[{"Field":"eventCategory","Equals":["Data"]},{"Field":"resources.type","Equals":["AWS::S3::Object"]},
     {"Field":"resources.ARN","StartsWith":["arn:aws:s3:::metnmat-media-prod/","arn:aws:s3:::metnmat-forensics-'$ACCOUNT'/","arn:aws:s3:::metnmat-deploy-artifacts-'$ACCOUNT'/"]}]}
]' >/dev/null
aws cloudtrail start-logging --region $REGION --name metnmat-trail
echo "metnmat-trail → s3://$LOGB (multi-region, validated, S3 data events on media/forensics/artifacts)"

say "GuardDuty"
DID=$(aws guardduty list-detectors --region $REGION --query 'DetectorIds[0]' --output text)
if [ "$DID" = "None" ] || [ -z "$DID" ]; then
  DID=$(aws guardduty create-detector --region $REGION --enable --finding-publishing-frequency FIFTEEN_MINUTES --query DetectorId --output text)
fi
echo "detector $DID"
# Route findings ≥ medium to the same e-mail via EventBridge.
aws events put-rule --region $REGION --name metnmat-guardduty-findings --event-pattern '{"source":["aws.guardduty"],"detail-type":["GuardDuty Finding"],"detail":{"severity":[{"numeric":[">=",4]}]}}' --state ENABLED >/dev/null
aws events put-targets --region $REGION --rule metnmat-guardduty-findings --targets "Id=sns,Arn=$TOPIC" >/dev/null
aws sns set-topic-attributes --region $REGION --topic-arn "$TOPIC" --attribute-name Policy --attribute-value "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Sid\":\"owner\",\"Effect\":\"Allow\",\"Principal\":{\"AWS\":\"arn:aws:iam::$ACCOUNT:root\"},\"Action\":\"SNS:*\",\"Resource\":\"$TOPIC\"},{\"Sid\":\"events\",\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"events.amazonaws.com\"},\"Action\":\"SNS:Publish\",\"Resource\":\"$TOPIC\"},{\"Sid\":\"cw\",\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"cloudwatch.amazonaws.com\"},\"Action\":\"SNS:Publish\",\"Resource\":\"$TOPIC\"}]}"
echo "GuardDuty findings (severity ≥ medium) → $TOPIC"

echo; echo "Monitoring in place. Confirm the SNS e-mail, then test: aws cloudwatch set-alarm-state --alarm-name metnmat-prod-cpu-high --state-value ALARM --state-reason test"
