const express = require("express");
const admin = require("firebase-admin");

const app = express();
const port = process.env.PORT || 3000;

// ✅ Parse Firebase credentials from environment variable
const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

app.get("/digest", async (req, res) => {
  const now = new Date();
  const hour = now.getHours();

  if (hour !== 16 && hour !== 21) {
    return res.status(400).send("Invalid trigger time");
  }

  try {
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const jobsSnapshot = await db
      .collection("jobs")
      .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(threeHoursAgo))
      .get();

    if (jobsSnapshot.empty) {
      return res.send("No trending jobs found");
    }

    const trendingJobs = jobsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    await admin.messaging().send({
      topic: "trending_jobs",
      notification: {
        title: "🔥 Trending Jobs",
        body: `${trendingJobs.length} new jobs posted recently. Check them out!`,
      },
    });

    res.send("Trending jobs notification sent");
  } catch (error) {
    console.error("Error sending digest:", error);
    res.status(500).send("Server error");
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
