# CloudFrontIPSelector

CloudFrontIPSelector是一个用来选择连接延迟最低的CloudFront IP的工具。

## 背景

由于AWS的DNS功能非常优秀，AWS CloudFront的用户通常能够享受到非常稳定的体验。但是，有时候，由于网络环境或其他原因，DNS可能会返回一些不太理想的IP，导致连接速度变慢或不稳定。

因此，一些中国用户倾向于绑定Host去 以优化访问CloudFront的体验。我创建这个脚本的目的是去选择一个低延迟的IP以便于中国用户绑定IP。

### How to use?

1. 配置环境.
如果一些人还没有node环境，我推荐[nvm](https://github.com/nvm-sh/nvm) or [nvm-windows](https://github.com/coreybutler/nvm-windows.) 去设置一下该环境.

2. 运行这个js 脚本.
```
npm install
node ./
```

3. 等待数分钟后，打开 项目目录下的`result.txt`去查看结果.


### In addition

a. 我在当前脚本的代码里限制了被过滤的IP延迟的上限，如果你想改变, 您可以尝试修改 variable `THREASHOLD`在 `main.js`里.

b. 您想尝试 Gcore-CDN吗?  我已经写了另外一个工作于Gcore的IP-selector : https://github.com/BruceWind/GcoreCDNIPSelector, 您可以尝试一下.

### 声明
- 本项目用于修复网络体验问题，请遵守当地法律，请勿用于爬🪜。
- 本程序不会定期更新CloudFront IP，所以如果你发现连接质量下降，你可以重新运行本程序来获取最新的IP。
