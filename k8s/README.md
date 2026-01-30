# Kubernetes Deployment for Grover Microservices

This directory contains Kubernetes manifests for deploying the Grover microservices platform.

## Prerequisites

- Kubernetes cluster (minikube, kind, GKE, EKS, or AKS)
- kubectl configured
- Docker images built and pushed to registry

## Quick Start

### 1. Build Docker Images

```bash
# Build all images
docker build -t grover/gateway:latest -f microservices/gateway/Dockerfile .
docker build -t grover/user-service:latest -f microservices/user-service/Dockerfile .
docker build -t grover/post-service:latest -f microservices/post-service/Dockerfile .
docker build -t grover/media-service:latest -f microservices/media-service/Dockerfile .
docker build -t grover/payment-service:latest -f microservices/payment-service/Dockerfile .

# For production, push to registry
docker tag grover/gateway:latest your-registry/grover/gateway:latest
docker push your-registry/grover/gateway:latest
# ... repeat for all services
```

### 2. Update Secrets

Edit `k8s/secrets.yaml` with your actual values:

```yaml
stringData:
  JWT_SECRET: "your-jwt-secret"
  PAYPAL_CLIENT_ID: "your-paypal-client-id"
  PAYPAL_CLIENT_SECRET: "your-paypal-client-secret"
  CLOUDINARY_CLOUD_NAME: "your-cloud-name"
  CLOUDINARY_API_KEY: "your-api-key"
  CLOUDINARY_API_SECRET: "your-api-secret"
```

### 3. Deploy to Kubernetes

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Create ConfigMap and Secrets
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml

# Deploy MongoDB
kubectl apply -f k8s/mongodb.yaml

# Wait for MongoDB to be ready
kubectl wait --for=condition=ready pod -l app=mongodb -n grover --timeout=120s

# Deploy services
kubectl apply -f k8s/services.yaml

# Deploy gateway (Load Balancer)
kubectl apply -f k8s/gateway.yaml

# Check deployment status
kubectl get all -n grover
```

### 4. Access the Application

```bash
# Get gateway external IP (for LoadBalancer)
kubectl get service gateway-service -n grover

# Port-forward for local testing
kubectl port-forward service/gateway-service 8000:8000 -n grover

# Access
curl http://localhost:8000/health
```

## Architecture

```
┌─────────────────────────────────────┐
│         Internet / Users            │
└─────────────┬───────────────────────┘
              │
┌─────────────▼───────────────────────┐
│  LoadBalancer / Ingress            │
│  gateway-service (8000)             │
└─────────────┬───────────────────────┘
              │
      ┌───────┴───────┐
      │               │
┌─────▼─────┐   ┌────▼────┐
│ Gateway   │   │ Gateway │
│ Pod 1     │   │ Pod 2   │
└─────┬─────┘   └────┬────┘
      │               │
      └───────┬───────┘
              │
    ┌─────────┼─────────┬─────────┐
    │         │         │         │
┌───▼──┐  ┌──▼──┐  ┌──▼──┐  ┌───▼──┐
│User  │  │Post │  │Media│  │Pay.  │
│Svc   │  │Svc  │  │Svc  │  │Svc   │
└──┬───┘  └──┬──┘  └─────┘  └───┬──┘
   │         │                   │
   └────┬────┴───────────────────┘
        │
   ┌────▼────┐
   │ MongoDB │
   └─────────┘
```

## Resource Allocation

### Requests (Guaranteed)
- Gateway: 250m CPU, 256Mi RAM
- User Service: 250m CPU, 256Mi RAM
- Post Service: 250m CPU, 256Mi RAM
- Media Service: 250m CPU, 256Mi RAM
- Payment Service: 250m CPU, 256Mi RAM

### Limits (Maximum)
- All services: 500m CPU, 512Mi RAM

### Replicas
- Gateway: 2 (high availability)
- User Service: 2 (authentication critical)
- Post Service: 3 (highest load)
- Media Service: 2
- Payment Service: 2
- MongoDB: 1 (use managed service in production)

## Scaling

### Manual Scaling

```bash
# Scale post service to 5 replicas
kubectl scale deployment post-service --replicas=5 -n grover

# Scale gateway to 3 replicas
kubectl scale deployment gateway --replicas=3 -n grover
```

### Horizontal Pod Autoscaler

```bash
# Auto-scale based on CPU
kubectl autoscale deployment post-service \
  --cpu-percent=70 \
  --min=3 \
  --max=10 \
  -n grover
```

## Monitoring

### Check Logs

```bash
# Gateway logs
kubectl logs -f deployment/gateway -n grover

# User service logs
kubectl logs -f deployment/user-service -n grover

# All services
kubectl logs -f -l app=gateway -n grover --tail=100
```

### Check Health

```bash
# Service health
kubectl exec -it deployment/gateway -n grover -- \
  curl http://localhost:8000/health

# All services health via gateway
kubectl port-forward service/gateway-service 8000:8000 -n grover &
curl http://localhost:8000/health/services
```

## Troubleshooting

### Pod not starting

```bash
# Describe pod
kubectl describe pod -l app=gateway -n grover

# Check events
kubectl get events -n grover --sort-by='.lastTimestamp'
```

### Service not accessible

```bash
# Check services
kubectl get services -n grover

# Check endpoints
kubectl get endpoints -n grover

# Test connectivity
kubectl run test --rm -it --image=curlimages/curl -n grover -- \
  curl http://gateway-service:8000/health
```

### Database issues

```bash
# Check MongoDB
kubectl exec -it deployment/mongodb -n grover -- mongosh

# Check PVC
kubectl get pvc -n grover

# Check storage
kubectl describe pvc mongodb-pvc -n grover
```

## Production Considerations

### Use Managed Services
- **Database**: Use managed MongoDB (MongoDB Atlas, AWS DocumentDB)
- **Message Queue**: Use managed RabbitMQ (AWS MQ, CloudAMQP)
- **Load Balancer**: Use cloud provider's load balancer

### Security
```bash
# Use secrets from cloud provider
kubectl create secret generic grover-secrets \
  --from-literal=JWT_SECRET=$(aws secretsmanager get-secret-value ...) \
  -n grover
```

### Persistent Storage
```yaml
# Use dynamic provisioning
storageClassName: gp3  # AWS EBS
# or
storageClassName: standard-rwo  # GKE
```

### Monitoring
- Deploy Prometheus Operator
- Configure ServiceMonitor for each service
- Set up Grafana dashboards
- Configure alerts

### Ingress
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: grover-ingress
  namespace: grover
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - api.grover.com
    secretName: grover-tls
  rules:
  - host: api.grover.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: gateway-service
            port:
              number: 8000
```

## Cleanup

```bash
# Delete all resources
kubectl delete namespace grover

# Or delete individually
kubectl delete -f k8s/services.yaml
kubectl delete -f k8s/gateway.yaml
kubectl delete -f k8s/mongodb.yaml
kubectl delete -f k8s/configmap.yaml
kubectl delete -f k8s/secrets.yaml
kubectl delete -f k8s/namespace.yaml
```

## Testing on Minikube

```bash
# Start minikube
minikube start --cpus=4 --memory=8192

# Enable ingress
minikube addons enable ingress

# Deploy
kubectl apply -f k8s/

# Get service URL
minikube service gateway-service -n grover --url

# Clean up
minikube delete
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to Kubernetes

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    
    - name: Build images
      run: |
        docker build -t ${{ secrets.REGISTRY }}/gateway:${{ github.sha }} -f microservices/gateway/Dockerfile .
    
    - name: Push images
      run: |
        docker push ${{ secrets.REGISTRY }}/gateway:${{ github.sha }}
    
    - name: Update K8s
      run: |
        kubectl set image deployment/gateway \
          gateway=${{ secrets.REGISTRY }}/gateway:${{ github.sha }} \
          -n grover
```

## References

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [Horizontal Pod Autoscaler](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
