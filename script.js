document.getElementById("downloadBtn").addEventListener("click", async () => {
  const url = document.getElementById("url").value;
  const format = document.getElementById("format").value;
  const status = document.getElementById("status");

  if (!url) {
    status.textContent = "⚠️ Please enter a valid URL.";
    return;
  }

  status.textContent = "⏳ Preparing your download...";

  // Backend placeholder (we’ll connect this later)
  const backendUrl = "https://https://y2matez-backend.onrender.com/";

  try {
    const res = await fetch(backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, format })
    });

    if (!res.ok) throw new Error("Failed to download");

    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "downloaded_video";
    a.click();

    status.textContent = "✅ Download complete!";
  } catch (err) {
    status.textContent = "❌ Error downloading video.";
  }
});
