// Import required modules
const express = require('express'); // Express for handling HTTP requests
const NodeCache = require('node-cache'); // NodeCache for in-memory caching
const axios = require('axios'); // Axios for making HTTP requests

// Initialize Express application
const app = express();

// Initialize cache with a default TTL (time-to-live) of 10 minutes
const cache = new NodeCache({ stdTTL: 600 });

// Function to fetch data from the external API
const fetchDataFromAPI = async (symbol, period, startTime, endTime) => {
  try {
    // Replace with the actual API endpoint and query parameters
    const response = await axios.get(`https://external.api/timeseries`, {
      params: { symbol, period, start: startTime, end: endTime },
    });
    return response.data; // Return the fetched data
  } catch (error) {
    // Log the error for debugging and throw a custom error message
    console.error('Error fetching data from API:', error.message);
    throw new Error('Failed to fetch data from the external API');
  }
};

// Route to handle GET /timeseries requests
app.get('/timeseries', async (req, res) => {
  // Destructure query parameters from the request
  const { symbol, period, start, end } = req.query;

  // Validate required query parameters
  if (!symbol || !period || !start || !end) {
    return res
      .status(400)
      .json({ error: 'Symbol, period, start time, and end time are required' });
  }

  // Generate a unique cache key for the request based on its parameters
  const cacheKey = `${symbol}-${period}-${start}-${end}`;

  // Check if data is already cached
  let cachedData = cache.get(cacheKey);
  if (cachedData) {
    // If cached data is found, return it immediately
    return res.json(cachedData);
  }

  // Array to store the complete dataset
  let data = [];
  // Array to store intervals that are not cached
  let missingIntervals = [];

  // Determine the cached intervals based on the request
  const cacheIntervals = determineCacheIntervals(symbol, period, start, end);

  // Check which intervals are cached and which are missing
  for (const interval of cacheIntervals) {
    const intervalData = cache.get(interval.key);
    if (intervalData) {
      data.push(...intervalData); // Add cached data to the response
    } else {
      missingIntervals.push(interval); // Add missing intervals for later fetching
    }
  }

  // Fetch missing intervals from the external API if necessary
  if (missingIntervals.length > 0) {
    try {
      for (const interval of missingIntervals) {
        // Fetch data for the missing interval
        const intervalData = await fetchDataFromAPI(
          symbol,
          period,
          interval.start,
          interval.end
        );
        // Cache the fetched data for the interval
        cache.set(interval.key, intervalData);
        // Add the fetched data to the response
        data.push(...intervalData);
      }
    } catch (error) {
      // Return an error response if the external API call fails
      return res
        .status(500)
        .json({ error: 'Failed to fetch data from external API' });
    }
  }

  // Cache the combined result for the entire request
  cache.set(cacheKey, data);

  // Return the final data response
  res.json(data);
});

// Function to determine cached intervals
const determineCacheIntervals = (symbol, period, start, end) => {
  // This function calculates the time intervals for caching.
  // Currently, it assumes 1-minute intervals. Adjust as needed.
  const intervals = [];
  const startDate = new Date(start);
  const endDate = new Date(end);

  while (startDate <= endDate) {
    const key = `${symbol}-${period}-${startDate.toISOString()}`;
    intervals.push({
      key,
      start: startDate.toISOString(),
      end: new Date(startDate.getTime() + 60000).toISOString(), // 1-minute interval
    });
    startDate.setMinutes(startDate.getMinutes() + 1); // Increment by 1 minute
  }

  return intervals;
};

// Start the Express server on a given port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
