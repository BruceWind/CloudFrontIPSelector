# CloudFrontIPSelector

CloudFrontIPSelector是一个用来选择连接延迟最低的CloudFront IP的工具。

## 背景

由于AWS的DNS功能非常优秀，AWS CloudFront的用户通常能够享受到非常稳定的体验。但是，多数情况下DNS可能会返回一些不太理想的IP，导致连接速度变慢或不稳定。

因此，一些中国用户倾向于绑定Host去 以优化访问CloudFront的体验。我创建这个脚本的目的是去选择一个低延迟的IP以便于中国用户绑定IP。

### How to use?

1. 配置环境

如果一些人还没有node环境，我推荐[nvm](https://github.com/nvm-sh/nvm) or [nvm-windows](https://github.com/coreybutler/nvm-windows.) 去设置一下该环境.

2. 连接到一个稳定的网络环境

建议您使用**网线**连接您的计算机，否则您必须确保您的WIFI连接是稳定的。如果没有稳定的连接，此脚本可能无法获取任何延迟低于 阈值 的IP地址。
判断您的WIFI连接是否稳定的一个技巧是 ping 1分钟您的网关IP（例如 192.168.0.1或192.168.50.1，这一般取决于你的本地IP。一般情况下，将您的本地IP的最后一个数字改为1即为网关）。或将您的笔记本电脑移近您的路由器。

3. 运行这个js 脚本.
```
npm install
node ./
```

4. 等待
 
等待数分钟后，打开 项目目录下的`result.txt`去查看结果.


### In addition

a. 我在当前脚本的代码里限制了被过滤的IP延迟的门槛（阈值），如果你跑脚本发现获取不到任何IP, 您可以尝试修改 variable `THREASHOLD`在 `main.js`里.

b. 您想尝试 Gcore-CDN吗?  我已经写了另外一个工作于Gcore的IP-selector : https://github.com/BruceWind/GcoreCDNIPSelector, 您可以尝试一下.

### 声明
- 本项目用于修复网络体验问题，请遵守当地法律，请勿用于爬🪜。
- 本程序不会定期更新CloudFront IP，所以如果你发现连接质量下降，你可以重新运行本程序来获取最新的IP。
