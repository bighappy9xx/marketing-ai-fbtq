#!/bin/zsh
# Open this file in Terminal. Never put an API key in this launcher.
cd -- "${0:A:h}" || exit 1
export PATH="$HOME/.local/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"
node scripts/setup-openai.cjs
fbtq_setup_status=$?
echo
read -r '?Nhấn Enter để đóng cửa sổ này…'
exit "$fbtq_setup_status"
