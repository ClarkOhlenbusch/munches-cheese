import { put, list } from '@vercel/blob';

// Helper to parse body from Vercel Node handler
async function parseBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      try {
        return Object.fromEntries(new URLSearchParams(req.body));
      } catch {
        return {};
      }
    }
  }
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        try {
          resolve(Object.fromEntries(new URLSearchParams(data)));
        } catch {
          resolve({});
        }
      }
    });
  });
}

// Fetch current summary from Blob storage
async function getSummary() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  try {
    const { blobs } = await list({ prefix: 'data/summary.json', token });
    if (blobs.length > 0 && (blobs[0].downloadUrl || blobs[0].url)) {
      const fetchUrl = blobs[0].downloadUrl || blobs[0].url;
      const res = await fetch(`${fetchUrl}&_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (res.ok) {
        return await res.json();
      }
    }
  } catch (err) {
    console.error('Error fetching summary blob:', err);
  }
  return {
    totalCount: 0,
    signups: [],
    demandVotes: [],
    storeStats: {},
    flavorStats: {},
    lastUpdated: new Date().toISOString()
  };
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Blob storage token not configured' });
  }

  // GET: Return live count & basic public stats
  if (req.method === 'GET') {
    try {
      const summary = await getSummary();
      res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=15');
      return res.status(200).json({
        success: true,
        totalCount: summary.totalCount || 0,
        demandCount: (summary.demandVotes || []).length,
        lastUpdated: summary.lastUpdated
      });
    } catch (err) {
      console.error('GET error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST: Record waitlist signup or store demand vote
  if (req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const isDemandOnly = body.type === 'store_demand';
      const email = (body.email || '').trim().toLowerCase();
      const name = (body.name || '').trim();
      const zip = (body.zip || '').trim();
      const store = (body.store || 'Costco Wholesale').trim();
      const flavor = (body.flavor || 'Spicy Jalapeño 🌶️').trim();

      if (!isDemandOnly && (!email || !email.includes('@'))) {
        return res.status(400).json({ success: false, error: 'Valid email is required.' });
      }

      const summary = await getSummary();
      const now = new Date().toISOString();

      let ticketNumber = null;
      let newEntry = null;

      if (isDemandOnly) {
        // Store demand vote
        newEntry = {
          id: `demand_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: 'store_demand',
          zip: zip || 'USA',
          store: store,
          timestamp: now
        };
        if (!summary.demandVotes) summary.demandVotes = [];
        summary.demandVotes.push(newEntry);
      } else {
        // Waitlist signup
        // Check if email already registered
        const existing = (summary.signups || []).find((s) => s.email === email);
        if (existing) {
          return res.status(200).json({
            success: true,
            alreadyRegistered: true,
            ticketNumber: existing.ticketNumber,
            totalCount: summary.totalCount || summary.signups.length,
            message: 'You are already registered for Batch 001!'
          });
        }

        const newCount = (summary.totalCount || (summary.signups || []).length) + 1;
        ticketNumber = '#MUNCH-' + newCount.toString().padStart(5, '0');

        newEntry = {
          id: `munch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          ticketNumber,
          type: 'waitlist',
          name: name || 'Snack Legend',
          email,
          zip: zip || 'USA',
          store,
          flavor,
          timestamp: now
        };

        if (!summary.signups) summary.signups = [];
        summary.signups.push(newEntry);
        summary.totalCount = newCount;
      }

      // Update aggregations
      if (!summary.storeStats) summary.storeStats = {};
      summary.storeStats[store] = (summary.storeStats[store] || 0) + 1;

      if (!isDemandOnly) {
        if (!summary.flavorStats) summary.flavorStats = {};
        summary.flavorStats[flavor] = (summary.flavorStats[flavor] || 0) + 1;
      }

      summary.lastUpdated = now;

      // 1. Write atomic individual backup entry in Blob
      await put(`entries/${newEntry.id}.json`, JSON.stringify(newEntry), {
        access: 'public',
        token
      });

      // 2. Update master summary.json in Blob
      await put('data/summary.json', JSON.stringify(summary), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        token
      });

      return res.status(200).json({
        success: true,
        ticketNumber,
        totalCount: summary.totalCount || 0,
        store: newEntry.store,
        flavor: newEntry.flavor,
        message: isDemandOnly ? 'Store demand vote recorded!' : 'VIP allocation confirmed!'
      });
    } catch (err) {
      console.error('POST error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
