#!/usr/bin/env bash
# launch-instance.sh — create the fresh production host and everything it needs.
# Run from an operator machine with administrative AWS credentials. Idempotent
# where AWS allows it (looks up existing resources by name before creating).
#
# Creates:  security group metnmat-prod-web-sg (80/443 in, all out)
#           IAM role metnmat-prod-host-role + instance profile (SSM core + 4 secrets + artifacts)
#           IAM user metnmat-cms-media (media bucket only) — key goes straight into metnmat/cms/env
#           EC2 t3.large, AL2023, gp3 30 GB ENCRYPTED, IMDSv2 required hop-limit 1, NO key pair
#           Elastic IP (new — the old one is on the Spamhaus XBL)
# Prints the ids at the end. Nothing is copied from the old host.
set -Eeuo pipefail
export AWS_PAGER=""
REGION=ap-south-1; ACCOUNT=976134557584
VPC=${VPC:-vpc-01ca116e04ad1b105}
SUBNET=${SUBNET:-subnet-094f9fdeed75745f0}          # ap-south-1b, public
TYPE=${INSTANCE_TYPE:-t3.large}
NAME=${INSTANCE_NAME:-metnmat-prod-2}
HERE="$(cd "$(dirname "$0")" && pwd)"

say() { printf '\n== %s ==\n' "$*"; }

say "AMI (latest AL2023, x86_64)"
AMI=$(aws ssm get-parameter --region $REGION --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-6.1-x86_64 --query Parameter.Value --output text 2>/dev/null \
  || aws ssm get-parameter --region $REGION --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 --query Parameter.Value --output text)
echo "$AMI"

say "Security group"
SG=$(aws ec2 describe-security-groups --region $REGION --filters Name=group-name,Values=metnmat-prod-web-sg Name=vpc-id,Values=$VPC --query 'SecurityGroups[0].GroupId' --output text)
if [ "$SG" = "None" ]; then
  SG=$(aws ec2 create-security-group --region $REGION --group-name metnmat-prod-web-sg --description "METNMAT prod host: HTTPS/HTTP only, no SSH (SSM)" --vpc-id $VPC --query GroupId --output text)
  aws ec2 authorize-security-group-ingress --region $REGION --group-id $SG --ip-permissions \
    '[{"IpProtocol":"tcp","FromPort":80,"ToPort":80,"IpRanges":[{"CidrIp":"0.0.0.0/0"}],"Ipv6Ranges":[{"CidrIpv6":"::/0"}]},
      {"IpProtocol":"tcp","FromPort":443,"ToPort":443,"IpRanges":[{"CidrIp":"0.0.0.0/0"}],"Ipv6Ranges":[{"CidrIpv6":"::/0"}]}]' >/dev/null
  aws ec2 create-tags --region $REGION --resources $SG --tags Key=Name,Value=metnmat-prod-web-sg
fi
echo "$SG"

say "Host role + instance profile"
ROLE=metnmat-prod-host-role
if ! aws iam get-role --role-name $ROLE >/dev/null 2>&1; then
  aws iam create-role --role-name $ROLE --description "METNMAT prod host: SSM + four app secrets + artifact read. No S3 media, no Bedrock." \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
fi
aws iam attach-role-policy --role-name $ROLE --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
aws iam put-role-policy --role-name $ROLE --policy-name metnmat-prod-host-inline --policy-document "file://$HERE/instance-role-policy.json"
aws iam get-instance-profile --instance-profile-name $ROLE >/dev/null 2>&1 || aws iam create-instance-profile --instance-profile-name $ROLE >/dev/null
aws iam list-instance-profiles-for-role --role-name $ROLE --query 'InstanceProfiles[].InstanceProfileName' --output text | grep -q "$ROLE" \
  || aws iam add-role-to-instance-profile --instance-profile-name $ROLE --role-name $ROLE
echo "$ROLE"

say "CMS media IAM user (S3 media bucket only)"
MU=metnmat-cms-media
aws iam get-user --user-name $MU >/dev/null 2>&1 || aws iam create-user --user-name $MU --tags Key=purpose,Value="Payload CMS media bucket access; key lives only in metnmat/cms/env" >/dev/null
aws iam put-user-policy --user-name $MU --policy-name media-bucket-only --policy-document "file://$HERE/cms-media-user-policy.json"
echo "$MU (access key is created by provision-secrets.sh, never printed)"

say "Instance"
IID=$(aws ec2 describe-instances --region $REGION --filters Name=tag:Name,Values=$NAME Name=instance-state-name,Values=pending,running,stopping,stopped --query 'Reservations[0].Instances[0].InstanceId' --output text)
if [ "$IID" = "None" ]; then
  sleep 10   # instance-profile propagation
  IID=$(aws ec2 run-instances --region $REGION --image-id "$AMI" --instance-type $TYPE --subnet-id $SUBNET --security-group-ids $SG \
    --iam-instance-profile Name=$ROLE \
    --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":30,"VolumeType":"gp3","Encrypted":true,"DeleteOnTermination":true}}]' \
    --metadata-options HttpTokens=required,HttpPutResponseHopLimit=1,HttpEndpoint=enabled,InstanceMetadataTags=disabled \
    --monitoring Enabled=true \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$NAME},{Key=role,Value=metnmat-prod},{Key=built,Value=deploy-v2}]" "ResourceType=volume,Tags=[{Key=Name,Value=$NAME-root}]" \
    --query 'Instances[0].InstanceId' --output text)
fi
echo "$IID"
aws ec2 wait instance-running --region $REGION --instance-ids $IID

say "Elastic IP (new)"
EIP_ALLOC=$(aws ec2 describe-addresses --region $REGION --filters Name=tag:Name,Values=$NAME-eip --query 'Addresses[0].AllocationId' --output text)
if [ "$EIP_ALLOC" = "None" ]; then
  EIP_ALLOC=$(aws ec2 allocate-address --region $REGION --domain vpc --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=$NAME-eip}]" --query AllocationId --output text)
fi
aws ec2 associate-address --region $REGION --allocation-id $EIP_ALLOC --instance-id $IID --allow-reassociation >/dev/null
EIP=$(aws ec2 describe-addresses --region $REGION --allocation-ids $EIP_ALLOC --query 'Addresses[0].PublicIp' --output text)
echo "$EIP"

say "Waiting for SSM agent"
for i in $(seq 1 40); do
  st=$(aws ssm describe-instance-information --region $REGION --filters Key=InstanceIds,Values=$IID --query 'InstanceInformationList[0].PingStatus' --output text 2>/dev/null || true)
  [ "$st" = "Online" ] && break; sleep 10
done
echo "SSM: ${st:-not yet}"

cat <<EOF

DONE
  instance   $IID   ($TYPE, encrypted gp3, IMDSv2 hop 1, no key pair)
  eip        $EIP   (allocation $EIP_ALLOC)
  sg         $SG    (80/443 only)
  role       $ROLE
  cms user   $MU

Next:
  1. deploy/v2/aws/provision-secrets.sh          # creates metnmat/{web,cms,chat,cc}/env
  2. Bootstrap over SSM (ships deploy/v2 to the box, runs bootstrap-host.sh)
  3. Update metnmat-github-deploy: PROD_INSTANCE_ID=$IID in github-deploy-role-policy.json
  4. Deploy each app via its workflow, then move Cloudflare A records to $EIP
EOF
