# VPC, subnets, egress and security groups.
#
# Shape: public subnets hold the ALB (and, when NAT is disabled, the tasks
# themselves); private subnets hold the Fargate tasks. Nothing reaches a task
# except through the ALB — enforced by security group, not by subnet placement,
# so the enable_nat_gateway=false path is still not "open to the internet".

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, var.az_count)

  # /20 per subnet — far more addresses than this workload needs, but it leaves
  # room to add services without renumbering.
  public_subnets  = [for i in range(var.az_count) : cidrsubnet(var.vpc_cidr, 4, i)]
  private_subnets = [for i in range(var.az_count) : cidrsubnet(var.vpc_cidr, 4, i + 8)]

  nat_count = var.enable_nat_gateway ? (var.single_nat_gateway ? 1 : var.az_count) : 0

  # Where the tasks run. With NAT they sit private; without it they sit public
  # with a public IP, because a task with no NAT and no public IP cannot reach
  # MongoDB Atlas, Razorpay or Resend at all.
  task_subnet_ids  = var.enable_nat_gateway ? aws_subnet.private[*].id : aws_subnet.public[*].id
  assign_public_ip = !var.enable_nat_gateway
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${var.name_prefix}-vpc" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.name_prefix}-igw" }
}

# ── Public subnets ───────────────────────────────────────────────────────────

resource "aws_subnet" "public" {
  count                   = var.az_count
  vpc_id                  = aws_vpc.main.id
  cidr_block              = local.public_subnets[count.index]
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true

  tags = { Name = "${var.name_prefix}-public-${local.azs[count.index]}", Tier = "public" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = { Name = "${var.name_prefix}-rt-public" }
}

resource "aws_route_table_association" "public" {
  count          = var.az_count
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ── Private subnets + NAT ────────────────────────────────────────────────────

resource "aws_subnet" "private" {
  count             = var.az_count
  vpc_id            = aws_vpc.main.id
  cidr_block        = local.private_subnets[count.index]
  availability_zone = local.azs[count.index]

  tags = { Name = "${var.name_prefix}-private-${local.azs[count.index]}", Tier = "private" }
}

# Elastic IPs are the STABLE EGRESS ADDRESSES to add to the MongoDB Atlas IP
# access list. `terraform output atlas_allowlist_ips` prints them.
resource "aws_eip" "nat" {
  count  = local.nat_count
  domain = "vpc"
  tags   = { Name = "${var.name_prefix}-nat-eip-${count.index}" }
}

resource "aws_nat_gateway" "main" {
  count         = local.nat_count
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags       = { Name = "${var.name_prefix}-nat-${count.index}" }
  depends_on = [aws_internet_gateway.main]
}

resource "aws_route_table" "private" {
  count  = var.enable_nat_gateway ? var.az_count : 0
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[var.single_nat_gateway ? 0 : count.index].id
  }

  tags = { Name = "${var.name_prefix}-rt-private-${count.index}" }
}

resource "aws_route_table_association" "private" {
  count          = var.enable_nat_gateway ? var.az_count : 0
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# ── Security groups ──────────────────────────────────────────────────────────

resource "aws_security_group" "alb" {
  name        = "${var.name_prefix}-alb"
  description = "Public HTTPS/HTTP ingress to the load balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTPS from the internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP, redirected to HTTPS by the listener"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.name_prefix}-alb-sg" }
}

resource "aws_security_group" "tasks" {
  name        = "${var.name_prefix}-tasks"
  description = "Fargate tasks: inbound ONLY from the ALB"
  vpc_id      = aws_vpc.main.id

  # Deliberately sourced from the ALB security group rather than a CIDR. Even in
  # the no-NAT configuration where tasks carry public IPs, nothing on the
  # internet can open a connection to them.
  ingress {
    description     = "From the ALB only"
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Outbound must stay open: Atlas, Razorpay, Resend, Groq, Upstash, Meta and
  # ECR/Secrets Manager are all reached over the public internet.
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.name_prefix}-tasks-sg" }
}
