# CloudFrontIPSelector
to choose the CloudFront IPs with the lowest possible connection latency.

### Background
Because AWS's DNS function is so good, users of AWS CloudFront typically report having an extremely steady experience.

On the other hand, those living in China use it often get timeout, shipments lost and high latency. As a result, some people prefer to bind to CloudFront's domain using low-latency IP addresses. I created this script to choose IPs with the lowest latency in these situations.


### How to use?

1. set up node environment.
In case people who havn't set up node. I highly recommand [nvm](https://github.com/nvm-sh/nvm) or [nvm-windows](https://github.com/coreybutler/nvm-windows.) to set up.

2. run this JS file.
```
npm install
node ./main.js -r [region-code] # region code can be ap-northeast-1
```


# [Region table](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html#concepts-regions) :

| Code           | Name                      | Opt-in Status |
| -------------- | ------------------------- | ------------- |
| us-east-2      | US East (Ohio)            | Not required  |
| us-east-1      | US East (N. Virginia)     | Not required  |
| us-west-1      | US West (N. California)   | Not required  |
| us-west-2      | US West (Oregon)          | Not required  |
| af-south-1     | Africa (Cape Town)        | Required      |
| ap-east-1      | Asia Pacific (Hong Kong)  | Required      |
| ap-southeast-3 | Asia Pacific (Jakarta)    | Required      |
| ap-south-1     | Asia Pacific (Mumbai)     | Not required  |
| ap-northeast-3 | Asia Pacific (Osaka)      | Not required  |
| ap-northeast-2 | Asia Pacific (Seoul)      | Not required  |
| ap-southeast-1 | Asia Pacific (Singapore)  | Not required  |
| ap-southeast-2 | Asia Pacific (Sydney)     | Not required  |
| ap-northeast-1 | Asia Pacific (Tokyo)      | Not required  |
| ca-central-1   | Canada (Central)          | Not required  |
| eu-central-1   | Europe (Frankfurt)        | Not required  |
| eu-west-1      | Europe (Ireland)          | Not required  |
| eu-west-2      | Europe (London)           | Not required  |
| eu-south-1     | Europe (Milan)            | Required      |
| eu-west-3      | Europe (Paris)            | Not required  |
| eu-north-1     | Europe (Stockholm)        | Not required  |
| me-south-1     | Middle East (Bahrain)     | Required      |
| me-central-1   | Middle East (UAE)         | Required      |
| sa-east-1      | South America (São Paulo) | Not required  |


3. wait minites to get `result.txt` which contain best IPs will be saved in this folder.


### In addition

Have you tried Ccore-CDN? 

I have written another IP-selector for Gcore: https://github.com/BruceWind/GcoreCDNIPSelector, you can try it.
