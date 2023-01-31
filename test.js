import { isInSubnet, createChecker } from 'is-in-subnet';

import fetch from 'node-fetch';


const httpSettings = {
  method: "Get",
  headers: {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36'
  }
};

// to read this cidr url into array
const CN_CIDR = 'https://raw.githubusercontent.com/herrbischoff/country-ip-blocks/master/ipv4/cn.cidr';


setTimeout(async () => {
  console.log('begin');


  var response = await fetch(CN_CIDR, httpSettings);
  console.log('0 ');
  const body = await response.text();
  const arr = body.split('\n');
  if (arr.length < 1) throw new Error('empty arr.');

  console.log('1 ');
  let newArr = [];
  // print last one.
  arr.map((item, index) => {
    if (item)
      newArr.push(item);
  });
  console.log('2 ');

  const checker = createChecker(newArr);

  const result = checker('1.237.222.210');
  console.log('res: ' + result);
}, 10);
