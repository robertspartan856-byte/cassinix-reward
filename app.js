const API = window.location.protocol === "file:" ? "http://localhost:5000" : window.location.origin;

async function register() {
  const res = await fetch(API + "/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: document.getElementById("name").value,
      email: document.getElementById("email").value,
      password: document.getElementById("password").value,
      tier: document.getElementById("tier").value
    })
  });

  const data = await res.json();
  alert(data.message);
}

async function pickWinner() {
  const res = await fetch(API + "/pick-winner");
  const data = await res.json();

  document.getElementById("winner").innerText =
    "🏆 Winner: " + data.winner;
}