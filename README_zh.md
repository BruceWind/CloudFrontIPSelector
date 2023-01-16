# CloudFrontIPSelector
去选择一个极低延迟的CloudFront IP List



### Background
因为AWS's DNS很完美，AWS CloudFront的用户会有个稳定的网络体验。

但是，一些中国用户经常遇到网络超时，丢包 和 延迟问题。因此，一些中国用户倾向于绑定Host去 以优化访问CloudFront的体验。我创建这个脚本的目的是去选择一个低延迟的IP以便于中国用户绑定IP。

### How to use?

1. 配置环境.
如果一些人还没有node环境，我推荐[nvm](https://github.com/nvm-sh/nvm) or [nvm-windows](https://github.com/coreybutler/nvm-windows.) 去设置一下该环境.

2. 运行这个js 脚本.
```
npm install
node ./main.js
```

3. 等待数分钟后，打开 项目目录下的`result.txt`去查看结果.


### In addition

a. 我在当前脚本的代码里限制了被过滤的IP延迟的上限，如果你想改变, 您可以尝试修改 variable `THREASHOLD`在 `main.js`里. 

b. 您想尝试 Gcore-CDN吗?  我已经写了另外一个工作于Gcore的IP-selector : https://github.com/BruceWind/GcoreCDNIPSelector, 您可以尝试一下.

### 声明
本项目用于修复网络体验问题，请遵守当地法律，请勿用于爬🪜。
