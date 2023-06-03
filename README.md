# CloudFrontIPSelector

[中文](https://github.com/BruceWind/CloudFrontIPSelector/blob/main/README_zh.md)｜[English](https://github.com/BruceWind/CloudFrontIPSelector/blob/main/README.md)

to choose the the lowest latency IPs in order to improve CloudFront connections.


### Background
Because AWS's DNS function is so good, users of AWS CloudFront typically report having an extremely steady experience.

On the other hand, those living in China use it often get timeout, shipments lost and high latency. As a result, some people prefer to bind to CloudFront's domain using low-latency IP addresses. I created this script to choose IPs with the lowest latency in these situations.


### How to use?

1. set up node environment

In case people who havn't set up node. I highly recommand [nvm](https://github.com/nvm-sh/nvm) or [nvm-windows](https://github.com/coreybutler/nvm-windows.) to set up.

2. connect to a stable network environment

Please note that when the WIFI connection is unstable, it may result in a longer latency between your computer and router. This can have a negative impact on the scan process and may affect the accuracy of the results.

It is recommended to connect an **ethernet** wire and your computer, otherwise you must make sure your WIFI connection is stable. Without a stable connection, this script may can not obtain any IPs that latency below  **threshold**.
A tips to know if your WIFI connection is stable is to ping your gateway IP(e.g. 192.168.0.1 or 192.168.50.1 which depends your local-IP, whose last number changed to 1). Or move your laptop close to your router.

3. run this JS file.
```
npm install
node ./
```

4. wait

wait minites to get `result.txt` which contain best IPs will be saved in this folder.


### In addition

a. I limited latency of selected IPs must below 80, if you want to change it, you can modify  this variable `THREASHOLD` in `index.js`.

b. Have you tried Gcore-CDN?   I have written another IP-selector for Gcore: https://github.com/BruceWind/GcoreCDNIPSelector, you can try it.


c. Why don't I test **the up/down speed**? I've tested it and found that all IPs of Cloudfront have very high speed. As a result, there is no evidence to suggest that different IPs have different speeds. In other words, there is no need to differentiate between high-speed IPs and low-speed IPs.

**Thanks**

[sapics/ip-location-db](https://github.com/sapics/ip-location-db) provides geoip databse.
