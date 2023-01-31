import fetch from 'node-fetch';
import ping from 'ping';
import fs from 'node:fs';
import cliProgress from 'cli-progress';
import { isInSubnet, createChecker } from 'is-in-subnet';

import { BlockList } from "net"

// pls make sure this is identical url from https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/LocationsOfEdgeServers.html.
//const OFFICIAL_AWS_IPs_URL = "https://d7uri8nf7uskq.cloudfront.net/tools/list-cloudfront-ips" //it is deprecated because it is without region.
const OFFICIAL_AWS_IPs_URL = "https://ip-ranges.amazonaws.com/ip-ranges.json"

// const PREFIX_IP_REQUEST_URL = "http://ip-api.com/json/"

"use strict"

import netmask from 'netmask';

const Netmask = netmask.Netmask;

const PING_THREADS = 300;
const THREASHOLD = 50;

let countOfBeingProcess = 0;
// this is the pattern of the latency from ping result.
const latencyPattern = /time=(\d+)\sms/gm;


const httpSettings = {
  method: "Get",
  headers: {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36'
  }
};

// to read this cidr url into array
const CN_MAINLAND_CIDR = 'https://raw.githubusercontent.com/herrbischoff/country-ip-blocks/master/ipv4/cn.cidr';

//it is from github.
const GEO_IP_RANGES_URL = "https://raw.githubusercontent.com/sapics/ip-location-db/master/dbip-country/dbip-country-ipv4.csv";

const JP_CIDR = 'https://raw.githubusercontent.com/herrbischoff/country-ip-blocks/master/ipv4/jp.cidr';
const HK_CIDR = 'https://raw.githubusercontent.com/herrbischoff/country-ip-blocks/master/ipv4/hk.cidr';
const SG_CIDR = 'https://raw.githubusercontent.com/herrbischoff/country-ip-blocks/master/ipv4/sg.cidr';




let filteredIPs = [];

// create a new progress bar instance and use shades_classic theme

const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

// it is used to exclude China IPs.
async function queryNation(ip) {


  try {
    var response = await fetch(PREFIX_IP_REQUEST_URL + ip, httpSettings);
    const body = await response.text();

    const json = JSON.parse(body);
    console.log(`${ip} is from ${json.country}.`);
    return json.countryCode;
  }
  catch (e) {
    console.error(`queryNation encounter an error,`, e.message);
    return undefined;
  }

}


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 
async function main() {
  await sleep(30);
  try {
    const chinaMainLandIPChecker = await extractIPRanges('CN');
    const jpIPChecker = await extractIPRanges('JP');
    const sgIPChecker = await extractIPRanges('SG');
    const hkIPChecker = await extractIPRanges('HK');

    console.log(`start to obtain IP ranges...`);
    var response = await fetch(OFFICIAL_AWS_IPs_URL, httpSettings);
    const body = await response.text();
    const json = JSON.parse(body);
    if (!json.prefixes || json.prefixes.length == 0) {
      console.error("prefixes is empty.");
      process.exit(1);
      return;
    }

    console.log(`start to filter available subnets...`);
    // items of this are CIDR, its doc is here https://datatracker.ietf.org/doc/rfc4632/.
    const arrOfIPRanges = [];
    for (let i = 0; i < json.prefixes.length; i++) {
      const item = json.prefixes[i];
      if (item.service == "CLOUDFRONT") {
        arrOfIPRanges.push(item.ip_prefix);
      }
    }

    if (arrOfIPRanges.length == 0) {
      console.error(`Got nothing from ${OFFICIAL_AWS_IPs_URL}, you could try again!`);
      process.exit(1);
    }
    else {
      console.log(`Got ${arrOfIPRanges.length} subnets. Start to check which nation IPs belongs to.`);
    }

    for (const range of arrOfIPRanges) {
      // if (filteredIPs.length > 10000) break;
      let netmask = new Netmask(range);
      netmask.forEach(async (ip) => {
        if (jpIPChecker.check(ip)) {
          filteredIPs.push(ip);
        }
      })
    }


    console.log(`IPs.length is ${filteredIPs.length}`);
    if (filteredIPs.length < 1) {
      //exit 1
      process.exit(1);
    }

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
    const availableGates = [];
    for (let i = 0; i < gates.length; i++) {
      const item = gates[i];

      const addIfNeed = (latency) => {
        if (latency > 500) {
          removalGates.push({ ip: item, latency });
          // console.log(item, 'added', latency);
        }
        else {
          availableGates.push({ ip: item, latency });
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
    console.log(`availableGates.length is ${availableGates.length}`);

    // fs.writeFile('removalGates.txt', JSON.stringify(removalGates), function (err) {
    //     if (err) return console.error(err);
    // });
    // fs.writeFile('availableGates.txt', JSON.stringify(availableGates), function (err) {
    //     if (err) return console.error(err);
    // });



    //to  reset filteredIPs
    filteredIPs.slice(0, filteredIPs.length);
    for (let i = 0; i < availableGates.length; i++) {
      const gate = availableGates[i];
      const gatePrefix = gate.ip.substring(0, gate.ip.length - 1);

      //for each from 1 to 255
      for (let iOfGate = 1; iOfGate < 255; iOfGate++) {
        filteredIPs.push(gatePrefix + iOfGate);
      }
    }

    console.log(`try to ping ${filteredIPs.length} IPs...`);


    const unsortedArr = [];
    let processIndex = 0;
    const maxProcess = filteredIPs.length;


    bar1.start(maxProcess, processIndex);

    const processPrinter = setInterval(async () => {
      bar1.update(processIndex);
      // console.log(`process: ${processIndex}/${maxProcess}. And got ${unsortedArr.length} available IPs.`);
    }, 1000 * 10);

    for (let i = 0; i < filteredIPs.length; i++) {
      const ip = filteredIPs[i];
      processIndex++;
      if (unsortedArr.length >= 2000) {// to save time.
        console.log('Already got enough IPs, stop pinging.');
        break;
      }
      while (countOfBeingProcess > PING_THREADS) {
        await sleep(30);
      }

      {
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

    while (countOfBeingProcess > 5) {
      await sleep(30);
    }
    // stop the progress bar
    bar1.stop();

    console.log(`unsortedArr.length is ${unsortedArr.length}`);
    // to sort the array by the latency.
    let resultArr = unsortedArr
      .filter(item => (item.ip.split('.').pop() > 1)) // last number of ip maybe as a network gate, So it can't use as CDN IP.
      .sort((a, b) => a.latency - b.latency);

    // to cut 100 IPs from the array by priority.
    if (resultArr.length > 100) {
      resultArr = resultArr.slice(0, 200);
    }

    clearInterval(processPrinter);

    //to save this sorted array to 'result.txt'.
    fs.writeFile('result-new.txt', JSON.stringify(resultArr), function (err) {
      if (err) return console.error(err);
    });

    const strPrefix = resultArr.length == 0 ? 'Oops' : 'Congradulations';

    console.log(`${strPrefix}! Got ${resultArr.length} IPs. `);
    if (resultArr.length == 0) {
      console.log('You could try increasing THREASHOLD.');
    }

  } catch (e) {
    console.error('Sorry,', e.message);
    process.exit(1);
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



// return 1000 or latency.
async function queryAvgLatency(ip) {
  try {
    await queryLatency(ip); // this line looks like useless, but In my opinion, this can make connection reliable. 
    const latency1 = await queryLatency(ip);
    // console.log(`${ip} latency1 is ${latency1}`);
    if (latency1 > THREASHOLD * 2) return latency1;

    const latency2 = await queryLatency(ip);
    // console.log(`${ip} latency2 is ${latency2}`);
    if (latency2 > THREASHOLD * 1.5) return latency2;


    const latency3 = await queryLatency(ip);
    // console.log(`${ip} latency3 is ${latency3}`);
    let result = (latency1 + latency2 + latency3) / 3

    return Math.round(result);
  }
  catch (e) {
    console.log(`${ip} is not reachable.`, e.message);
  }
  return 1000;
}


let ipDB = null;
async function extractIPRanges(shortNation) {
  shortNation = shortNation.toUpperCase();
  console.log('extractIPRanges requesting... with nation: ' + shortNation);
  if (!ipDB) {
    var response = await fetch(GEO_IP_RANGES_URL, httpSettings);

    const body = await response.text();
    ipDB = body.split('\n');
  }


  const blockList = new BlockList()
  // to foreach the ipDB, and find the IP range of the nation. the item of ipDB is like this: 13.35.0.0,13.35.7.255,TW
  ipDB.map((item, index) => {
    const split = item.split(',');
    if (split[2] == shortNation) {
      blockList.addRange(split[0], split[1]);
    }
  });

  console.log('extractIPRanges done. ');

  return blockList;




}
