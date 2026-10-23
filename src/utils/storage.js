// Optimized localStorage utilities to prevent blocking main thread

const storageQueue = [];
let isProcessing = false;

// Process storage queue during idle time
const processQueue = () => {
  if (isProcessing || storageQueue.length === 0) return;

  isProcessing = true;

  const processBatch = () => {
    const batch = storageQueue.splice(0, 5); // Process 5 items at a time

    batch.forEach(({ key, value }) => {
      try {
        localStorage.setItem(key, value);
      } catch (err) {
        console.error('Storage error:', err);
      }
    });

    if (storageQueue.length > 0) {
      requestIdleCallback(processBatch, { timeout: 1000 });
    } else {
      isProcessing = false;
    }
  };

  requestIdleCallback(processBatch, { timeout: 1000 });
};

// Non-blocking localStorage.setItem
export const setItemAsync = (key, value) => {
  storageQueue.push({ key, value: JSON.stringify(value) });
  processQueue();
};

// Non-blocking localStorage.getItem (already synchronous but wrapped for consistency)
export const getItem = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('Storage read error:', err);
    return null;
  }
};

// Non-blocking localStorage.removeItem
export const removeItemAsync = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.error('Storage remove error:', err);
  }
};

// Clear all storage
export const clearStorage = () => {
  try {
    localStorage.clear();
  } catch (err) {
    console.error('Storage clear error:', err);
  }
};
