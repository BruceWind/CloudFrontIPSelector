import fetch from 'node-fetch';
import ping from 'ping';
import fs from 'node:fs';
import cliProgress from 'cli-progress';
import { isInSubnet, createChecker } from 'is-in-subnet';


"use strict"

import { BlockList } from "net"

import netmask from 'netmask';
const Netmask = netmask.Netmask;

const PING_THREADS = 300;

// If you live in east of China, I recommend trying a value of 50.
const THREASHOLD = 80;    // if you got no IPs in result, you can try enlarge this value to 120. 


// create a new progress bar instance and use shades_classic theme
const terminalBarUI = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
let countOfBeingProcess = 0;


// pls make sure this is identical url from https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/LocationsOfEdgeServers.html.
//const OFFICIAL_AWS_IPs_URL = "https://d7uri8nf7uskq.cloudfront.net/tools/list-cloudfront-ips" //it is deprecated because it is without region.
const OFFICIAL_AWS_IPs_URL = "https://ip-ranges.amazonaws.com/ip-ranges.json"
// this is the pattern of the latency from ping result.
// const latencyPattern = /time=(\d+)\sms/gm;
const httpSettings = {
  method: "Get",
  headers: {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36'
  }
};

// It is used to read IP database from this url into array.
// it is from github.
// const GEO_IP_RANGES_URL = "http://raw.githubusercontent.com/sapics/ip-location-db/master/dbip-country/dbip-country-ipv4.csv";

const GEO_IP_RANGES_URL = "./dbip-country-ipv4.csv";

let filteredIPs = [];

// it is used to block execution.
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 
async function main() {

  // First step: to read nation short name from command line. or use default value JP.
  const args = process.argv.slice(2);
  let nationShortName = 'JP';
  if (args.length > 0) {
    if (args.length > 1) {
      console.error("Too many arguments. You can only input one argument, e.g. 'node index.js JP' ");
      process.exit(1);
    }
    // a regex to match nation short name with 2 letters.
    const regex = /^[A-Z]{2}$/;
    if (regex.test(args[0])) {
      nationShortName = args[0];
    }
    else {
      console.error("The argument is not a valid nation short name, e.g. 'JP' ");
      process.exit(1);
    }
  }



  try {
    // create a IP checker for filtering IPs limited to a nation given from command line.
    const nationalIPChecker = await extractIPRanges(nationShortName);

    console.log(`start to obtain IP ranges...`);
    //to read CDN IPs from AWS.
    var response = await fetch(OFFICIAL_AWS_IPs_URL, httpSettings);
    const body = await response.text();
    const json = JSON.parse(body);
    if (!json.prefixes || json.prefixes.length == 0) {
      console.error("prefixes is empty.");
      process.exit(1);
      return;
    }

    // ---------------- to filter available subnets ----------------
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
        if (nationalIPChecker.check(ip)) {
          filteredIPs.push(ip);
        }
      })
    }

    console.log(`IPs.length is ${filteredIPs.length}`);
    if (filteredIPs.length < 1) {
      //exit 1
      process.exit(1);
    }
    // ---------------- to filter available subnets end ----------------



    //--------------------------to find available network-gates --------------------------
    // to filter network-gates which is open. 
    // I assume that if the network-gate is open, 254 IPs behind it are probably open as well.
    // Ans this step is also reduce the all process time.
    console.log(`start to detect network-gates open...`);
    //to detect network-gate is open.
    const gates = [];
    const availableGates = []; // this should be used into next step.
    for (let i = 0; i < filteredIPs.length; i++) {
      const ip = filteredIPs[i];
      // if string ip last is '.0'
      if (ip.split('.').pop() == '0') {
        gates.push(ip);
      }
    }

    console.log(`Got ${gates.length} gates.`);

    for (let i = 0; i < gates.length; i++) {
      const item = gates[i];

      const addIfNeed = (latency) => {
        if (latency > 500) {
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
    console.log(`availableGates.length is ${availableGates.length}`);
    //--------------------------to find available network-gates end --------------------------


    //--------------------------to  reset filteredIPs --------------------------
    filteredIPs = [];  // clear this array.
    if(filteredIPs.length > 0) {
      throw new Error('\nfilteredIPs should be empty.');
    }
    for (let i = 0; i < availableGates.length; i++) {
      const gate = availableGates[i];
      const gatePrefix = gate.ip.substring(0, gate.ip.length - 1);

      // put last numbers from 1 to 125, instead of 255. 
      // it is means avoid some IPs providing same user experience.
      for (let fourthPart = 1; fourthPart < 125; fourthPart++) {
        if(fourthPart < 50 || fourthPart % 3 == 0) { //reducing IPs to save time.
          filteredIPs.push(gatePrefix + fourthPart);
        }
      }
    }

    console.log(`try to ping ${filteredIPs.length} IPs...`);

    //--------------------------to  reset filteredIPs end--------------------------

    const unsortedArr = [];
    let processIndex = 0;
    const maxProcess = filteredIPs.length;


    terminalBarUI.start(maxProcess, processIndex);

    const processPrinter = setInterval(async () => {
      terminalBarUI.update(processIndex);
      // console.log(`process: ${processIndex}/${maxProcess}. And got ${unsortedArr.length} available IPs.`);
    }, 1000 * 5);

    for (let i = 0; i < filteredIPs.length; i++) {
      const ip = filteredIPs[i];
      processIndex++;
      if (unsortedArr.length >= 200) {// to save time.
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
    terminalBarUI.stop();

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
    fs.writeFile('result.txt', JSON.stringify(resultArr), function (err) {
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



async function readTextFile(filePath) {
  try {
    const data = await fs.promises.readFile(filePath, 'utf8');
    return data;
  } catch (error) {
    console.error(error);
  }
}

async function extractIPRanges(shortNation) {
  let ipDB = null;
  shortNation = shortNation.toUpperCase();
  console.log('Extracting IP ranges with nation: ' + shortNation);
  if (!ipDB) {
    // console.log('This step is downloading a large IP DB file, you will probably wait for 2-3 minutes. In case it is running excess 3 minites, please stop it and then try again. ');
    // var response = await fetch(GEO_IP_RANGES_URL, httpSettings);

    // const body = await response.text();
    // ipDB = body.split('\n');

    // to read local file : GEO_IP_RANGES_URL with await.
    ipDB = (await readTextFile(GEO_IP_RANGES_URL)).split('\n');
  }


  const blockList = new BlockList()
  // to foreach the ipDB, and find the IP range of the nation. the item of ipDB is like this: 13.35.0.0,13.35.7.255,TW
  ipDB.map((item, index) => {
    const split = item.split(',');
    if (split[2] == shortNation) {
      blockList.addRange(split[0], split[1]);
    }
  });

  return blockList;

}
