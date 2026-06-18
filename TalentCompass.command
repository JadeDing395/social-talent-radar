#!/bin/bash
PORT=3200
URL="http://localhost:$PORT"
PROJECT="/Users/jade/Desktop/DD/TalentCompass"
NPM="/Users/jade/.nvm/versions/node/v24.13.0/bin/npm"

# 已在运行则直接打开
if curl -s -o /dev/null -w "%{http_code}" --max-time 2 "$URL" 2>/dev/null | grep -qE "^[23]"; then
  open "$URL"
  osascript -e 'tell application "Terminal" to close first window' 2>/dev/null &
  exit 0
fi

# 释放端口 + 清除 Next.js dev 锁
lsof -ti:$PORT | xargs kill -9 2>/dev/null
rm -f "$PROJECT/.next/dev/logs/*.json" 2>/dev/null

# 后台静默启动
cd "$PROJECT"
nohup "$NPM" run dev > /tmp/talentcompass.log 2>&1 &

# 等待就绪（最多 40 秒）
echo "TalentCompass 启动中..."
for i in $(seq 1 40); do
  sleep 1
  if curl -s -o /dev/null -w "%{http_code}" --max-time 1 "$URL" 2>/dev/null | grep -qE "^[23]"; then
    open "$URL"
    osascript -e 'tell application "Terminal" to close first window' 2>/dev/null &
    exit 0
  fi
done

echo "启动失败，请查看 /tmp/talentcompass.log"
