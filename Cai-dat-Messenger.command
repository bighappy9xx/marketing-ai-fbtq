#!/bin/zsh
cd -- "${0:A:h}" || exit 1
export PATH="$HOME/.local/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"
node scripts/setup-messenger.cjs
fbtq_messenger_setup_status=$?
echo
read -r '?Nhấn Enter để đóng cửa sổ này…'
exit "$fbtq_messenger_setup_status"
