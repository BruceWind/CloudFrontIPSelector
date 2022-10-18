import { exec } from 'node:child_process';
import fetch from 'node-fetch';
import fs from 'node:fs';
// pls make sure this is identical url from https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/LocationsOfEdgeServers.html.
//const OFFICIAL_AWS_IPs_URL = "https://d7uri8nf7uskq.cloudfront.net/tools/list-cloudfront-ips" //it is deprecated because it is without region.
const OFFICIAL_AWS_IPs_URL = "https://ip-ranges.amazonaws.com/ip-ranges.json"

"use strict"

import netmask from 'netmask';

const Netmask = netmask.Netmask;

const PING_THREADS = 100;
let countOfBeingProcess = 0;
// this is the pattern of the latency from ping result.
const latencyPattern = /time=(\d+)\sms/gm;

function execPromise(command) {
    return new Promise(function (resolve, reject) {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(stdout.trim());
        });
    });
}




let filteredIPs = [];

// 
async function main() {
    try {
        let settings = { method: "Get" };
        var response = await fetch(OFFICIAL_AWS_IPs_URL, settings);
        const body = await response.text();
        const json = JSON.parse(body);
        // items of this are CIDR, its doc is here https://datatracker.ietf.org/doc/rfc4632/.
        const arrOfIPRanges = [];
        for (const item of json.prefixes) {
            if (item.service.includes("CLOUDFRONT") && item.region.includes("ap-")) {
                arrOfIPRanges.push(item.ip_prefix);
            }
        }

        for (const ipRnage of arrOfIPRanges) {
            let netmask = new Netmask(ipRnage);
            netmask.forEach(async (ip) => {
                filteredIPs.push(ip);
            })
        }


        console.log(`IPs.length is ${filteredIPs.length}`);

        const unsortedArr = [];
        for (let i = 0; i < filteredIPs.length; i++) {
            const ip = filteredIPs[i];

            if (countOfBeingProcess > PING_THREADS || i < filteredIPs.length - 100) {
                countOfBeingProcess++;
                try {

                    const avgLatency = await queryAvgLatency(ip);
                    if (avgLatency < 150) {
                        unsortedArr.push({ ip, latency: avgLatency });
                    }
                    countOfBeingProcess--;
                }
                catch (e) {

                    countOfBeingProcess--;
                }
            }
            else {
                countOfBeingProcess++;
                queryAvgLatency(ip).then(function (avgLatency) {
                    if (avgLatency < 150) {
                        unsortedArr.push({ ip, latency: avgLatency });
                    }
                    countOfBeingProcess--;
                }).catch(function (e) {
                    countOfBeingProcess--;
                });
            }
        }

        console.log(`unsortedArr.length is ${unsortedArr.length}`);
        // to sort the array by the latency.
        const resultArr = unsortedArr.sort((a, b) => {
            return a.latency - b.latency;
        });

        //to save this sorted array to 'result.txt'.

        fs.writeFile('result.txt', JSON.stringify(resultArr), function (err) {
            if (err) return console.log(err);
        });

    } catch (e) {
        console.error(e.message);
    }
}

setTimeout(main, 100);

async function queryLatency(ip) {
    const pingCommand = `ping -c 1 -W 1 ${ip}`;

    try {
        const resultOfPing = await execPromise(pingCommand);
        // console.log(resultOfPing);
        const arr = latencyPattern.exec(resultOfPing);
        if (!arr[1]) return 1000;
        console.log(`${ip}'s latency is ${arr[1]}`);

        return Number(arr[1]);
    }
    catch (e) {
        // console.log(`${ip} is not reachable.`);
    }
    return 1000;
}



async function queryAvgLatency(ip) {
    const pingCommand = `ping -c 1 -W 1 ${ip}`;

    try {
        await queryLatency(ip); // this line looks like useless, but In my opinion, this can make connection reliable. 
        const latency1 = await queryLatency(ip);
        if (latency1 > 200) return latency1;

        const latency2 = await queryLatency(ip);
        return (latency1 + latency2) / 2;
    }
    catch (e) {
        console.log(`${ip} is not reachable.`, e.message);
    }
    return 1000;
}