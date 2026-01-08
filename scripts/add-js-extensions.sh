#!/bin/bash
# Add .js extensions to relative imports for ESM compatibility

find src -name "*.ts" -not -path "*/node_modules/*" -type f -exec sed -i '' \
  -e "s|from '\(\./[^']*\)';|from '\1.js';|g" \
  -e "s|from \"\(\./[^\"]*\)\";|from \"\1.js\";|g" \
  -e "s|from '\(\.\./[^']*\)';|from '\1.js';|g" \
  -e "s|from \"\(\.\./[^\"]*\)\";|from \"\1.js\";|g" \
  -e "s|import('\(\./[^']*\)')|import('\1.js')|g" \
  -e "s|import(\"\(\./[^\"]*\)\")|import(\"\1.js\")|g" \
  -e "s|import('\(\.\./[^']*\)')|import('\1.js')|g" \
  -e "s|import(\"\(\.\./[^\"]*\)\")|import(\"\1.js\")|g" \
  {} \;

# Fix double .js.js extensions that might have been added
find src -name "*.ts" -not -path "*/node_modules/*" -type f -exec sed -i '' \
  -e "s|\.js\.js|.js|g" \
  -e "s|\.tsx\.js|.tsx|g" \
  {} \;

echo "✓ Added .js extensions to all relative imports"
