# 使用 Node.js LTS 作為基礎鏡像
FROM node:18

WORKDIR /app

# 複製 package.json 和 yarn.lock
COPY package.json ./

# 安裝依賴
RUN npm install

# 複製所有文件
COPY . .

# 暴露伺服器埠
EXPOSE 5001

# 啟動後端伺服器
CMD ["npm", "run", "dev"]
