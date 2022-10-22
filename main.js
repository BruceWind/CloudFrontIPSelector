import { exec } from 'node:child_process';
import fetch from 'node-fetch';
import ping from 'ping';
import fs from 'node:fs';
// pls make sure this is identical url from https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/LocationsOfEdgeServers.html.
//const OFFICIAL_AWS_IPs_URL = "https://d7uri8nf7uskq.cloudfront.net/tools/list-cloudfront-ips" //it is deprecated because it is without region.
const OFFICIAL_AWS_IPs_URL = "https://ip-ranges.amazonaws.com/ip-ranges.json"

const PREFIX_IP_LOCALATION = "http://ip2c.org/"

"use strict"

import netmask from 'netmask';

const Netmask = netmask.Netmask;

const PING_THREADS = 1000;
const THREASHOLD = 85;

let countOfBeingProcess = 0;
// this is the pattern of the latency from ping result.
const latencyPattern = /time=(\d+)\sms/gm;



let filteredIPs = [];

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


async function queryNation(ip) {

    const queryLocationCommand = `curl --max-time 6.5  --connect-timeout 6.0  ${PREFIX_IP_LOCALATION}${ip}`;
    let resultOfIP = 'UNKNOWN';
    try {
        resultOfIP = await execPromise(queryLocationCommand);
    }
    catch (e) {
        console.log(`${queryLocationCommand} is faield.`, e);
    }

    if (resultOfIP.includes(';')) {
        const nation = resultOfIP.split(";")[1].trim();
        return nation;
    }
    else {
        return 'UNKNOWN';
    }
}

// 
async function main() {

    if (THREASHOLD < 60) {
        //exist process.
        console.error("THREASHOLD must be greater than 60.");
        return;
    }
    try {
        console.log(`start to get json...`);
        let settings = { method: "Get" };
        var response = await fetch(OFFICIAL_AWS_IPs_URL, settings);
        const body = await response.text();
        const json = JSON.parse(body);

        console.log(`start to filter available subnets...`);
        // items of this are CIDR, its doc is here https://datatracker.ietf.org/doc/rfc4632/.
        const arrOfIPRanges = [];
        for (let i = 0; i < json.prefixes.length; i++) {
            const item = json.prefixes[i];
            if (item.service == "CLOUDFRONT") {
                let netmask = new Netmask(item.ip_prefix);
                const addIfNeed = async (latency) => {
                    if (latency < THREASHOLD * 1.5 && latency > 30) {
                        if (latency > 60) {
                            // console.log(item.ip_prefix, 'added', netmask.first, latency);
                            arrOfIPRanges.push(item.ip_prefix);
                        }
                        else {
                            const nation = await queryNation(netmask.first);
                            if (nation != 'CN') {
                                // console.log(item.ip_prefix, 'added', netmask.first, latency);
                                arrOfIPRanges.push(item.ip_prefix);
                            }
                        }
                    }
                    else {
                        // console.warn(item.ip_prefix, 'lost.', netmask.first, latency);
                    }
                }
                if (i % 20 == 0 || i > json.prefixes.length - 10) {
                    let latency = await queryAvgLatency(netmask.first);
                    await addIfNeed(latency);
                }
                else {
                    queryAvgLatency(netmask.first).then(latency => addIfNeed(latency));
                }
            }
        }

        for (const ipRnage of arrOfIPRanges) {
            // if (filteredIPs.length > 10000) break;
            let netmask = new Netmask(ipRnage);
            netmask.forEach(async (ip) => {
                filteredIPs.push(ip);
            })
        }


        console.log(`IPs.length is ${filteredIPs.length}`);

        console.log(`start to detect network-gates open...`);
        //to detect network-gate is open.
        const gates = [];
        for (let i = 0; i < filteredIPs.length; i++) {
            const ip = filteredIPs[i];
            // if string ip last is '.0'
            if (ip.split('.').pop() == '0') {
                gates.push(ip);
            }
        }

        console.log(`Got ${gates.length} gates.`);



        const removalGates = [];
        const shortGates = [];
        for (let i = 0; i < gates.length; i++) {
            const item = gates[i];

            const addIfNeed = (latency) => {
                if (latency > THREASHOLD * 1.2) {
                    removalGates.push({ ip: item, latency });
                    // console.log(item, 'added', latency);
                }
                else {
                    shortGates.push({ ip: item, latency });
                    // console.log(item, 'lost', latency);
                }
            }
            if (i % PING_THREADS == 0 || i > gates.length - Math.min(gates.length / 10, PING_THREADS / 10)) {
                let latency = await queryAvgLatency(item);
                addIfNeed(latency);
            }
            else {
                queryAvgLatency(item).then(latency => addIfNeed(latency));
            }

        }

        console.log(`removalGates.length is ${removalGates.length}`);
        console.log(`shortGates.length is ${shortGates.length}`);

        fs.writeFile('removalGates.txt', JSON.stringify(removalGates), function (err) {
            if (err) return console.error(err);
        });
        fs.writeFile('shortGates.txt', JSON.stringify(shortGates), function (err) {
            if (err) return console.error(err);
        });



        //to delete last char of gate.
        for (let i = 0; i < removalGates.length; i++) {
            const gate = removalGates[i];
            const gatePrefix = gate.ip.substring(0, gate.ip.length - 1);
            removalGates[i] = gatePrefix;
        }

        // to delete all IPs from filteredIPs, if match every one of removalGates.
        let lastestMatchIndex = 0;
        const deletedIPs = [];
        for (let i = 0; i < filteredIPs.length; i++) {
            const ip = filteredIPs[i];
            let isMatched = false;
            for (let j = lastestMatchIndex; j < removalGates.length; j++) {
                const gate = removalGates[j];
                if (ip.startsWith(gate)) {
                    isMatched = true;
                    lastestMatchIndex = j;
                    break;
                }
            }
            if (!isMatched) {
                deletedIPs.push(ip);
            }
        }

        console.log(`try to ping ${deletedIPs.length} IPs...`);


        const unsortedArr = [];
        let processIndex = 0;
        const maxProcess = deletedIPs.length;


        const processPrinter = setInterval(async () => {
            console.log(`process: ${processIndex}/${maxProcess}. And got ${unsortedArr.length} IPs.`);
        }, 1000 * 10);

        for (let i = 0; i < deletedIPs.length; i++) {
            const ip = deletedIPs[i];
            processIndex++;
            if (unsortedArr.length >= 200) {
                console.log('got enough IPs, stop pinging.');
                break;
            }
            if (countOfBeingProcess > PING_THREADS || i > deletedIPs.length - 100) {

                countOfBeingProcess++;
                try {

                    const avgLatency = await queryAvgLatency(ip);
                    if (avgLatency <= THREASHOLD) {
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
                    if (avgLatency <= THREASHOLD) {
                        unsortedArr.push({ ip, latency: avgLatency });
                    }
                    else {
                        // if (avgLatency < THREASHOLD * 1.5) {
                        //     console.warn(`although ${ip}'s latency is ${avgLatency}, I don't keep it.`);
                        // }
                    }
                    countOfBeingProcess--;
                }).catch(function (e) {
                    countOfBeingProcess--;
                });
            }
        }

        console.log(`unsortedArr.length is ${unsortedArr.length}`);
        // to sort the array by the latency.
        let resultArr = unsortedArr
            .filter(item => (item.ip.split('.').pop() != '0'))
            .sort((a, b) => a.latency - b.latency);

        // to cut 100 IPs from the array by priority.
        if (resultArr.length > 100) {
            resultArr = resultArr.slice(0, 200);
        }

        clearInterval(processPrinter);

        //to save this sorted array to 'result.txt'.
        fs.writeFile('result.txt', JSON.stringify(resultArr), function (err) {
            if (err) return console.error(err);
        });

        console.log(`Done.`);

    } catch (e) {
        console.error(e.message);
    }
}

setTimeout(main, 100);

async function queryLatency(ip) {
    try {
        const result = await ping.promise.probe(ip, {
            timeout: 1,
        });

        return result.alive ? Math.round(result.avg) : 1000;
    }
    catch (e) {
        console.error(`${ip} is not reachable.`, e.message);
    }
    return 1000;
}



async function queryAvgLatency(ip) {
    try {
        await queryLatency(ip); // this line looks like useless, but In my opinion, this can make connection reliable. 
        const latency1 = await queryLatency(ip);
        if (latency1 > THREASHOLD * 2) return latency1;

        const latency2 = await queryLatency(ip);
        if (latency2 > THREASHOLD * 1.5) return latency2;


        const latency3 = await queryLatency(ip);
        let result = (latency1 + latency2 + latency3) / 3

        return Math.round(result);
    }
    catch (e) {
        console.log(`${ip} is not reachable.`, e.message);
    }
    return 1000;
}