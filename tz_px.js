import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import "dotenv/config";

export const checkTz = async (username) => {
  // 1. Check if env vars exist
  if (!process.env.proxy_server || !process.env.proxy_password) {
    console.error("CRITICAL: Missing proxy_server or proxy_password in .env");
    return "America/New_York";
  }

  const proxyHost = process.env.proxy_server;
  // Ensure proxyHost includes port (e.g., ip:port). If not, append it if known.

  // 2. SAFETY: URL Encode credentials
  // If your password contains special chars like @, :, or #, it breaks the URL.
  const proxyUsername = encodeURIComponent(username);
  const proxyPassword = encodeURIComponent(process.env.proxy_password);

  // 3. Construct URL
  const proxyUrl = `http://${proxyUsername}:${proxyPassword}@${proxyHost}`;

  // Debugging: Print the host to ensure it's not "undefined" (Don't log full URL with password)
  // console.log(`Attempting connection via proxy host: ${proxyHost}`);

  const proxyAgent = new HttpsProxyAgent(proxyUrl);

  try {
    const response = await axios.get(
      "https://worker-purple-wind-1de7.idrissimahdi2020.workers.dev/",
      {
        httpsAgent: proxyAgent,
        proxy: false, // Important: Tell axios to ignore standard proxy env vars and use the agent
        timeout: 15000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
        family: 4, // Force IPv4 resolution
      }
    );

    const ipDetails = { timezone: response.data?.trim() };
    return ipDetails.timezone || undefined;
  } catch (error) {
    // Improve error logging to see WHICH step failed
    const errorInfo = error.code
      ? `${error.code} - ${error.syscall}`
      : error.message;
    console.error(
      `Error fetching timezone (Proxy Host: ${proxyHost}): ${errorInfo}`
    );
    return undefined;
  }
};
