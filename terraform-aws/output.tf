output "vpc_id" {
  value = aws_vpc.eks_vpc.id
}

output "subnet_a_id" {
  value = aws_subnet.subnet_a.id
}

output "subnet_b_id" {
  value = aws_subnet.subnet_b.id
}

output "ecr_repo_url" {
  value = aws_ecr_repository.ecommerce_repo.repository_url
}
output "eks_cluster_name" {
  value = aws_eks_cluster.eks.name
}