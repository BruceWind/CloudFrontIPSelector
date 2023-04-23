# CloudFrontIPSelector 

[中文](https://github.com/BruceWind/CloudFrontIPSelector/blob/main/README_zh.md)｜[English](https://github.com/BruceWind/CloudFrontIPSelector/blob/main/README.md)

to choose the the lowest latency IPs in order to improve CloudFront connections.


### Background
Because AWS's DNS function is so good, users of AWS CloudFront typically report having an extremely steady experience.

On the other hand, those living in China use it often get timeout, shipments lost and high latency. As a result, some people prefer to bind to CloudFront's domain using low-latency IP addresses. I created this script to choose IPs with the lowest latency in these situations.


### How to use?

1. set up node environment.
In case people who havn't set up node. I highly recommand [nvm](https://github.com/nvm-sh/nvm) or [nvm-windows](https://github.com/coreybutler/nvm-windows.) to set up.

2. run this JS file.
```
npm install
node ./
```

3. wait minites to get `result.txt` which contain best IPs will be saved in this folder.


### In addition

a. I limited latency of selected IPs must below 80, if you want to change it, you can modify  this variable `THREASHOLD` in `main.js`.

b. Have you tried Gcore-CDN?   I have written another IP-selector for Gcore: https://github.com/BruceWind/GcoreCDNIPSelector, you can try it.

**Thanks**

[sapics/ip-location-db](https://github.com/sapics/ip-location-db) provides geoip databse.
