const express = require("express");
const admin = require("firebase-admin");

const app = express();
const port = process.env.PORT || 3000;

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

app.get("/digest", async (req, res) => {
  const now = new Date();
  const hour = now.getHours();

  let start, end;
  if (hour >= 15 && hour < 17) {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 0);
  } else if (hour >= 20 && hour < 22) {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0);
  } else {
    return res.status(400).send("Invalid trigger time");
  }

  try {
    const snapshot = await admin
      .firestore()
      .collection("jobs")
      .where("postedAt", ">=", admin.firestore.Timestamp.fromDate(start))
      .where("postedAt", "<=", admin.firestore.Timestamp.fromDate(end))
      .get();

    const jobs = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        score: (data.views || 0) + (data.applications || 0),
      };
    });

    const topJobs = jobs.sort((a, b) => b.score - a.score).slice(0, 3);

    if (topJobs.length === 0) {
      return res.status(200).send("No trending jobs found");
    }

    const jobTitles = topJobs
      .map((job) => `• ${job.title} at ${job.company}`)
      .join("\n");

    const payload = {
      notification: {
        title: "🔥 Trending Jobs Digest",
        body: jobTitles,
      },
      topic: "trending_jobs",
    };

    await admin.messaging().send(payload);
    res.status(200).send("Trending jobs notification sent");
  } catch (error) {
    console.error("Error sending digest:", error);
    res.status(500).send("Internal server error");
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
