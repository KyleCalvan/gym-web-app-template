#!/bin/bash
set -e

# Read the file
content=$(cat app/api/members/route.ts)

# Fix lowercase Params (the actual typo)
fixed=$(echo "$content" | sed 's/\.Params;/\.Params;/g')

# Write back
echo "$fixed" > app/api/members/route.ts

# Verify
if grep -q '\.Params;' app/api/members/route.ts; then
  echo "ERROR: Still contains .Params;"
  exit 1
fi

if grep -q '\.Params;' app/api/members/route.ts; then
  echo "SUCCESS: File now contains .Params;"
else
  echo "ERROR: File does not contain .Params;"
  exit 1
fi
