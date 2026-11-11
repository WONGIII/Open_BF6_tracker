# 快速发布（本地构建 → 上传 `.next`）

线上服务器是低配 Ubuntu 主机，容器内 `next build` 要 12–16 分钟。日常发布改为：

1. 本地 `npm run build`（约 40 秒）
2. 打包 `.next` 上传到服务器（约 16 MB / 20 秒）
3. 解压、替换路径、原子切换、重启容器（约 1 分钟）

```bash
# 本地
npm run build
tar -czf /tmp/next-local.tgz -C . .next

# 上传（或 scp）
scp /tmp/next-local.tgz wangiii@221.127.178.76:/tmp/next-upload.tgz

# 服务器
sudo mv /tmp/next-upload.tgz /openbf6tracker/.next-upload.tgz
sudo rm -rf /openbf6tracker/.next-upload
sudo mkdir /openbf6tracker/.next-upload
sudo tar -xzf /openbf6tracker/.next-upload.tgz -C /openbf6tracker/.next-upload --strip-components=1
# 把构建时的 Windows 绝对路径改成容器路径
sudo python3 - <<'PY'
p="/openbf6tracker/.next-upload/required-server-files.json"
s=open(p).read().replace("D:\\\\zcodeprojectxianmu\\\\openbf6tracker","/app")
open(p,"w").write(s)
PY
sudo sh -c 'cd /openbf6tracker && rm -rf .next-old && mv .next .next-old && mv .next-upload .next'
sudo docker restart openbf6tracker
```

## 什么时候不需要构建

- 只替换 `public/bf6/` 里**已存在**的图片文件：直接上传覆盖即可，无需 build、无需重启（Next 的文件清单只记录路径，不记录内容）。
- 新增图片文件：需要重新 build（`publicFiles` 清单在构建时生成）。

## 回滚

切换前会保留上一份 `.next-old`；新包异常时：

```bash
sudo sh -c 'cd /openbf6tracker && rm -rf .next && mv .next-old .next'
sudo docker restart openbf6tracker
```
