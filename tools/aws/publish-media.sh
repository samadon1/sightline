#!/usr/bin/env bash
# Publish the caption tracks, companion files and HLS renditions to S3 behind CloudFront: the
# publisher delivery path the app reads when `assets/raw/config.json` points `devHost` at the
# distribution. Idempotent: creates the private bucket, the origin access control and the
# distribution once (ids are written to tools/aws/config.env), then syncs and invalidates.
#
#   AWS_PROFILE=<profile> tools/aws/publish-media.sh [scene ...]      (default: tos-bridge tos-lab the-envelope)
#
# Layout in the bucket mirrors assets/: <scene>/captions.en.vtt, <scene>/companion.en.json, <scene>/hls/*
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"; cfg="$root/tools/aws/config.env"
[ -f "$cfg" ] && source "$cfg"
scenes=("$@"); [ ${#scenes[@]} -eq 0 ] && scenes=(tos-bridge tos-lab the-envelope)
region="${AWS_REGION:-$(aws configure get region || echo us-east-1)}"
acct="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="${BUCKET:-sightline-media-$acct}"

if ! aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "== creating private bucket $BUCKET in $region"
  if [ "$region" = "us-east-1" ]; then aws s3api create-bucket --bucket "$BUCKET" --region "$region" >/dev/null
  else aws s3api create-bucket --bucket "$BUCKET" --region "$region" --create-bucket-configuration "LocationConstraint=$region" >/dev/null; fi
  aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
  aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration '{"CORSRules":[{"AllowedOrigins":["*"],"AllowedMethods":["GET","HEAD"],"AllowedHeaders":["*"],"MaxAgeSeconds":3600}]}'
fi

if [ -z "${DISTRIBUTION_ID:-}" ]; then
  echo "== creating CloudFront distribution (origin access control, HTTPS only, GET and HEAD)"
  OAC_ID="$(aws cloudfront list-origin-access-controls --query "OriginAccessControlList.Items[?Name=='sightline-media-oac-$acct'].Id | [0]" --output text)"
  [ "$OAC_ID" = "None" ] || [ -z "$OAC_ID" ] && OAC_ID="$(aws cloudfront create-origin-access-control --origin-access-control-config "Name=sightline-media-oac-$acct,SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3" --query OriginAccessControl.Id --output text)"
  # AWS managed policies, looked up by name: cache optimised, forward CORS headers to S3, add simple CORS response headers
  CACHE_POLICY="$(aws cloudfront list-cache-policies --type managed --query "CachePolicyList.Items[?CachePolicy.CachePolicyConfig.Name=='Managed-CachingOptimized'].CachePolicy.Id | [0]" --output text)"
  ORIGIN_POLICY="$(aws cloudfront list-origin-request-policies --type managed --query "OriginRequestPolicyList.Items[?OriginRequestPolicy.OriginRequestPolicyConfig.Name=='Managed-CORS-S3Origin'].OriginRequestPolicy.Id | [0]" --output text)"
  HEADERS_POLICY="$(aws cloudfront list-response-headers-policies --type managed --query "ResponseHeadersPolicyList.Items[?ResponseHeadersPolicy.ResponseHeadersPolicyConfig.Name=='Managed-SimpleCORS'].ResponseHeadersPolicy.Id | [0]" --output text)"
  tmp="$(mktemp)"
  cat > "$tmp" <<EOF
{"CallerReference":"sightline-media-$(date +%s)","Comment":"Sightline: caption tracks, companion files and HLS renditions","Enabled":true,
 "Origins":{"Quantity":1,"Items":[{"Id":"s3-$BUCKET","DomainName":"$BUCKET.s3.$region.amazonaws.com","OriginAccessControlId":"$OAC_ID","S3OriginConfig":{"OriginAccessIdentity":""}}]},
 "DefaultCacheBehavior":{"TargetOriginId":"s3-$BUCKET","ViewerProtocolPolicy":"redirect-to-https",
   "AllowedMethods":{"Quantity":2,"Items":["GET","HEAD"],"CachedMethods":{"Quantity":2,"Items":["GET","HEAD"]}},"Compress":true,
   "CachePolicyId":"$CACHE_POLICY","OriginRequestPolicyId":"$ORIGIN_POLICY","ResponseHeadersPolicyId":"$HEADERS_POLICY"},
 "PriceClass":"PriceClass_100","HttpVersion":"http2","IsIPV6Enabled":true}
EOF
  read -r DISTRIBUTION_ID DOMAIN ARN < <(aws cloudfront create-distribution --distribution-config "file://$tmp" --query 'Distribution.[Id,DomainName,ARN]' --output text)
  rm -f "$tmp"
  aws s3api put-bucket-policy --bucket "$BUCKET" --policy "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Sid\":\"AllowCloudFrontRead\",\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"cloudfront.amazonaws.com\"},\"Action\":\"s3:GetObject\",\"Resource\":\"arn:aws:s3:::$BUCKET/*\",\"Condition\":{\"StringEquals\":{\"AWS:SourceArn\":\"$ARN\"}}}]}"
  printf 'BUCKET=%s\nDISTRIBUTION_ID=%s\nDOMAIN=%s\nAWS_REGION=%s\n' "$BUCKET" "$DISTRIBUTION_ID" "$DOMAIN" "$region" > "$cfg"
  echo "   distribution $DISTRIBUTION_ID at https://$DOMAIN (deploys in a few minutes)"
fi

echo "== syncing ${scenes[*]} to s3://$BUCKET"
for s in "${scenes[@]}"; do
  d="$root/assets/$s"; [ -d "$d/hls" ] || { echo "   $s: no hls rendition, skipped"; continue; }
  aws s3 cp "$d/captions.en.vtt" "s3://$BUCKET/$s/captions.en.vtt" --content-type "text/vtt; charset=utf-8" --cache-control "max-age=60" --only-show-errors
  aws s3 cp "$d/companion.en.json" "s3://$BUCKET/$s/companion.en.json" --content-type "application/json" --cache-control "max-age=60" --only-show-errors
  aws s3 sync "$d/hls" "s3://$BUCKET/$s/hls" --exclude "*" --include "*.m3u8" --content-type "application/vnd.apple.mpegurl" --cache-control "max-age=60" --only-show-errors
  aws s3 sync "$d/hls" "s3://$BUCKET/$s/hls" --exclude "*" --include "*.m4s" --include "*.mp4" --content-type "video/iso.segment" --cache-control "max-age=86400" --only-show-errors
  echo "   $s: captions, companion, $(ls "$d/hls" | wc -l | tr -d ' ') rendition files"
done
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*" --query 'Invalidation.Id' --output text | sed 's/^/   invalidation /'
echo "== done. Point the app at it: {\"devHost\": \"https://$DOMAIN\"} in apps/vega-player/assets/raw/config.json, then npm run bundle-assets and rebuild."
