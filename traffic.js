import { chromium } from "playwright";
import { newInjectedContext } from "fingerprint-injector";
import { checkTz } from "./tz_px.js";
import "dotenv/config";
import fs from "fs/promises";
import { getRandomProxy } from "./lib/actions.js";
import axios from "axios";
const bots = process.argv[2];
const url = process.argv[3];

function generateRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// High CPM Tier 1 Countries (Premium Ad Rates)
const tier1Countries = [
  "us",
  "us",
  "us",
  "us",
  "us",
  "us",
  "us",
  "us",
  "us",
  "us", // United States (highest CPM)
  "ca",
  "ca",
  "ca",
  "ca",
  "ca", // Canada
  "uk",
  "uk",
  "uk",
  "uk", // United Kingdom
  "au",
  "au",
  "au",
  "au", // Australia
  "de",
  "de",
  "de", // Germany
  "no",
  "no",
  "no", // Norway
  "se",
  "se",
  "se", // Sweden
  "ch",
  "ch", // Switzerland
  "dk",
  "dk", // Denmark
  "nl",
  "nl", // Netherlands
  "fi", // Finland
  "at", // Austria
  "ie", // Ireland
  "nz", // New Zealand
];

// Mid CPM Tier 2 Countries (Good Ad Rates)
const tier2Countries = [
  "fr",
  "fr",
  "fr", // France
  "jp",
  "jp", // Japan
  "sg",
  "sg", // Singapore
  "kr",
  "kr", // South Korea
  "it",
  "it", // Italy
  "es",
  "es", // Spain
  "be", // Belgium
  "hk", // Hong Kong
  "il", // Israel
  "ae", // United Arab Emirates
  "pt", // Portugal
  "gr", // Greece
  "pl", // Poland
  "cz", // Czech Republic
];

// Lower CPM Tier 3 Countries (Moderate Ad Rates)
const tier3Countries = [
  "in", // India
  "id", // Indonesia
  "ph", // Philippines
  "th", // Thailand
  "my", // Malaysia
  "eg", // Egypt
  "tr", // Turkey
  "pk", // Pakistan
  "bd", // Bangladesh
  "mx", // Mexico
  "br", // Brazil
  "ar", // Argentina
  "cl", // Chile
  "co", // Colombia
  "za", // South Africa
  "ua", // Ukraine
  "ro", // Romania
  "lk", // Sri Lanka
  "vn", // Vietnam
];

// Combine all tiers (weighted toward higher CPM countries)
const locations = [...tier1Countries, ...tier2Countries, ...tier3Countries];

// Function to select a random user preference
const weightedRandom = (weights) => {
  let totalWeight = weights.reduce((sum, weight) => sum + weight.weight, 0);
  let random = Math.random() * totalWeight;
  for (let i = 0; i < weights.length; i++) {
    if (random < weights[i].weight) return weights[i].value;
    random -= weights[i].weight;
  }
};

// Preferences for user agents and devices
const preferences = [
  {
    value: { device: "desktop", os: "windows", browser: "chrome" },
    weight: 20,
  },

  {
    value: { device: "mobile", os: "android", browser: "chrome" },
    weight: 100,
  },
];

export const generateNoise = () => {
  const shift = {
    r: Math.floor(Math.random() * 5) - 2,
    g: Math.floor(Math.random() * 5) - 2,
    b: Math.floor(Math.random() * 5) - 2,
    a: Math.floor(Math.random() * 5) - 2,
  };
  const webglNoise = (Math.random() - 0.5) * 0.01;
  const clientRectsNoise = {
    deltaX: (Math.random() - 0.5) * 2,
    deltaY: (Math.random() - 0.5) * 2,
  };
  const audioNoise = (Math.random() - 0.5) * 0.000001;

  return { shift, webglNoise, clientRectsNoise, audioNoise };
};

export const noisifyScript = (noise) => `
  (function() {
    const noise = ${JSON.stringify(noise)};

    // Canvas Noisify
    const getImageData = CanvasRenderingContext2D.prototype.getImageData;
    const noisify = function (canvas, context) {
      if (context) {
        const shift = noise.shift;
        const width = canvas.width;
        const height = canvas.height;
        if (width && height) {
          const imageData = getImageData.apply(context, [0, 0, width, height]);
          for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
              const n = ((i * (width * 4)) + (j * 4));
              imageData.data[n + 0] = imageData.data[n + 0] + shift.r;
              imageData.data[n + 1] = imageData.data[n + 1] + shift.g;
              imageData.data[n + 2] = imageData.data[n + 2] + shift.b;
              imageData.data[n + 3] = imageData.data[n + 3] + shift.a;
            }
          }
          context.putImageData(imageData, 0, 0); 
        }
      }
    };
    HTMLCanvasElement.prototype.toBlob = new Proxy(HTMLCanvasElement.prototype.toBlob, {
      apply(target, self, args) {
        noisify(self, self.getContext("2d"));
        return Reflect.apply(target, self, args);
      }
    });
    HTMLCanvasElement.prototype.toDataURL = new Proxy(HTMLCanvasElement.prototype.toDataURL, {
      apply(target, self, args) {
        noisify(self, self.getContext("2d"));
        return Reflect.apply(target, self, args);
      }
    });
    CanvasRenderingContext2D.prototype.getImageData = new Proxy(CanvasRenderingContext2D.prototype.getImageData, {
      apply(target, self, args) {
        noisify(self.canvas, self);
        return Reflect.apply(target, self, args);
      }
    });

    // Audio Noisify
    const originalGetChannelData = AudioBuffer.prototype.getChannelData;
    AudioBuffer.prototype.getChannelData = function() {
      const results = originalGetChannelData.apply(this, arguments);
      for (let i = 0; i < results.length; i++) {
        results[i] += noise.audioNoise; // Smaller variation
      }
      return results;
    };

    const originalCopyFromChannel = AudioBuffer.prototype.copyFromChannel;
    AudioBuffer.prototype.copyFromChannel = function() {
      const channelData = new Float32Array(arguments[1]);
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] += noise.audioNoise; // Smaller variation
      }
      return originalCopyFromChannel.apply(this, [channelData, ...Array.prototype.slice.call(arguments, 1)]);
    };

    const originalCopyToChannel = AudioBuffer.prototype.copyToChannel;
    AudioBuffer.prototype.copyToChannel = function() {
      const channelData = arguments[0];
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] += noise.audioNoise; // Smaller variation
      }
      return originalCopyToChannel.apply(this, arguments);
    };

    // WebGL Noisify
    const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function() {
      const value = originalGetParameter.apply(this, arguments);
      if (typeof value === 'number') {
        return value + noise.webglNoise; // Small random variation
      }
      return value;
    };

    // ClientRects Noisify
    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function() {
      const rect = originalGetBoundingClientRect.apply(this, arguments);
      const deltaX = noise.clientRectsNoise.deltaX; // Random shift between -1 and 1
      const deltaY = noise.clientRectsNoise.deltaY; // Random shift between -1 and 1
      return {
        x: rect.x + deltaX,
        y: rect.y + deltaY,
        width: rect.width + deltaX,
        height: rect.height + deltaY,
        top: rect.top + deltaY,
        right: rect.right + deltaX,
        bottom: rect.bottom + deltaY,
        left: rect.left + deltaX
      };
    };
  })();
`;

// Function to simulate random clicks on a page
const performRandomClicks = async (page) => {
  const numClicks = generateRandomNumber(2, 4); // Random number between 2 and 4
  for (let i = 0; i < 1; i++) {
    const width = await page.evaluate(() => window.innerWidth);
    const height = await page.evaluate(() => window.innerHeight);
    const x = generateRandomNumber(0, width);
    const y = generateRandomNumber(0, height);

    await page.mouse.click(x, y);
    console.log(`Click ${i + 1} performed at position (${x}, ${y})`);
    await page.waitForTimeout(generateRandomNumber(2000, 3000));
  }
};

const blockResources = async (page) => {
  await page.route("**/*", (route) => {
    const resourceType = route.request().resourceType();
    if (["image", "stylesheet", "media"].includes(resourceType)) {
      route.abort();
    } else {
      route.continue();
    }
  });
};

// Read proxies.txt and return a parsed proxy object or null.
// Supported line formats (common):
// - http://user:pass@host:port
// - user:pass@host:port
// - host:port
// - host:port:username:password
// const getRandomProxy = async () => {
//   try {
//     const data = await fs.readFile(
//       new URL("./proxies.txt", import.meta.url),
//       "utf8"
//     );
//     const lines = data.split(/\r?\n/).map((l) => l.trim());
//     if (!lines.length) return null;
//     const pick = lines[Math.floor(Math.random() * lines.length)];
//     // normalize
//     let line = pick.trim();

//     // If it already contains a protocol or an @, try URL parsing
//     try {
//       if (/^https?:\/\//i.test(line) || line.includes("@")) {
//         const url = new URL(
//           line.includes("@") && !/^https?:\/\//i.test(line)
//             ? `http://${line}`
//             : line
//         );
//         return {
//           server: url.hostname,
//           port: url.port || (url.protocol === "https:" ? "443" : "80"),
//           username: url.username || undefined,
//           password: url.password || undefined,
//           url: `${url.protocol}//${url.hostname}:${
//             url.port || (url.protocol === "https:" ? "443" : "80")
//           }`,
//         };
//       }
//     } catch (err) {
//       // fall through to manual parsing
//     }

//     const parts = line.split(":");
//     // host:port
//     if (parts.length === 2) {
//       return {
//         server: parts[0],
//         port: parts[1],
//         url: `http://${parts[0]}:${parts[1]}`,
//       };
//     }

//     // host:port:username:password (common in some lists)
//     if (parts.length === 4) {
//       return {
//         server: parts[0],
//         port: parts[1],
//         username: parts[2],
//         password: parts[3],
//         url: `http://${parts[0]}:${parts[1]}`,
//       };
//     }

//     // fallback: return null for unsupported formats
//     return null;
//   } catch (err) {
//     // If file missing or unreadable, just return null (no proxy)
//     console.warn(
//       "Could not read proxies.txt or file empty:",
//       err?.message || err
//     );
//     return null;
//   }
// };

// async function checkProxy(proxy) {
//   if (!proxy || !proxy.ipAddress || !proxy.port) return false;

//   try {
//     const response = await axios.get("http://httpbun.com/ip", {
//       proxy: {
//         protocol: "http",
//         host: proxy.ipAddress,
//         port: parseInt(proxy.port, 10),
//         auth:
//           proxy.username && proxy.password
//             ? { username: proxy.username, password: proxy.password }
//             : undefined,
//       },
//       timeout: 10000,
//       headers: { "User-Agent": "Mozilla/5.0 (ProxyCheckBot)" },
//     });

//     console.log(
//       `[SUCCESS] ${proxy.ipAddress}:${proxy.port}${
//         proxy.username ? `:${proxy.username}` : ""
//       } - ${JSON.stringify(response.data)}`
//     );
//     return true;
//   } catch (error) {
//     console.log(
//       `[FAIL] ${proxy.ipAddress}:${proxy.port} - ${error.message || error}`
//     );
//     return false;
//   }
// }
async function checkProxy(proxy) {
  if (!proxy || !proxy.ipAddress || !proxy.port) return false;

  try {
    const response = await axios.get("http://httpbun.com/ip", {
      proxy: {
        protocol: "http",
        host: "brd.superproxy.io",
        port: parseInt("22225", 10),
        auth: {
          username: "brd-customer-hl_19cb0fe8-zone-mw-country-us-session-rand",
          password: "p14eij0n27q7",
        },
      },
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0 (ProxyCheckBot)" },
    });

    console.log(
      `[SUCCESS] ${proxy.ipAddress}:${proxy.port}${
        proxy.username ? `:${proxy.username}` : ""
      } - ${JSON.stringify(response.data)}`
    );
    return true;
  } catch (error) {
    console.log(
      `[FAIL] ${proxy.ipAddress}:${proxy.port} - ${error.message || error}`
    );
    return false;
  }
}
const generateSessionId = (length = 32) => {
  let result = "";
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};
const OpenBrowser = async (link, proxy) => {
  const userPreference = weightedRandom(preferences);
  // console.log(userPreference);

  // Generate a long random session ID (supports large strings)
  const sessionId = generateSessionId(50); // Generate 50-character session ID
  const randomCountry =
    locations[generateRandomNumber(0, locations.length - 1)];
  const username = `brd-customer-hl_19cb0fe8-zone-mw-country-${randomCountry}-session-${sessionId}`;
  console.log(`Session: ${sessionId}, Country: ${randomCountry}`);
  const timezone = await checkTz(username);
  if (timezone == undefined) {
    return;
  }

  console.log("timezone ", timezone);

  const launchOptions = { headless: false };
  launchOptions.proxy = {
    server: process.env.proxy_server,
    username: username,
    password: process.env.proxy_password,
  };

  const browser = await chromium.launch(launchOptions);
  const context = await newInjectedContext(browser, {
    fingerprintOptions: {
      devices: [userPreference.device],
      browsers: [userPreference.browser],
      operatingSystems: [userPreference.os],
      mockWebRTC: true, // Disable WebRTC mocking
    },
    newContextOptions: {
      timezoneId: "America/New_York",
    },
  });
  try {
    const noise = generateNoise();
    const page = await context.newPage();
    // add media blockers
    await blockResources(page);
    await page.addInitScript(noisifyScript(noise));
    console.log("Browser view -> website:", link, "threads:", bots);
    await page.goto(link, { waitUntil: "load", timeout: 120000 });

    // Wait for network to settle after page load
    await page
      .waitForLoadState("networkidle", { timeout: 30000 })
      .catch(() => {});

    // Random initial wait (simulate human reading time: 5-15 seconds)
    const initialWait = generateRandomNumber(5000, 15000);
    await page.waitForTimeout(initialWait);
    await performRandomClicks(page);
    const dwellTime = generateRandomNumber(30000, 90000);
    await page.waitForTimeout(dwellTime);
  } catch (error) {
    console.log(error);
  } finally {
    await context.close();
    await browser.close();
  }
};

// const tasksPoll = async (views) => {
//   const concurrency = Number(bots) ? Number(bots) : 4;
//   // tasks array
//   const tasks = Array.from({ length: concurrency }).map(async () => {
//     const proxy = await getRandomProxy();
//     const isWorking = await checkProxy(proxy);
//     if (isWorking) {
//       return OpenBrowser(url ? url : "https://www.google.com", proxy);
//     } else {
//       return null;
//     }
//   });

//   await Promise.all(tasks);
// };

const tasksPoll = async (views) => {
  const concurrency = Number(bots) ? Number(bots) : 4;
  // tasks array
  const tasks = Array.from({ length: concurrency }).map(async () => {
    // const proxy = await getRandomProxy();
    return OpenBrowser(url ? url : "https://www.google.com", {});
  });

  await Promise.all(tasks);
};

const RunTasks = async () => {
  let views = 0;
  const tasks = 100;
  for (let i = 0; i < tasks; i++) {
    views++;
    console.log(views * Number(bots));
    await tasksPoll(views);
  }
};

RunTasks();
