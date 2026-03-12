/**
 * BUTTON CLICK HANDLERS
 *
 * Each button on the homepage has its own handler function below.
 * Replace the placeholder console.log with your own implementation.
 */

function onButton1Click() {
  console.log("Button 1 clicked -- implement me!");
}

function onButton2Click() {
  console.log("Button 2 clicked -- implement me!");
}

function onButton3Click() {
  console.log("Button 3 clicked -- implement me!");
}

function onButton4Click() {
  console.log("Button 4 clicked -- implement me!");
}

function onButton5Click() {
  console.log("Button 5 clicked -- implement me!");
}

function onButton6Click() {
  console.log("Button 6 clicked -- implement me!");
}

function onButton7Click() {
  console.log("Button 7 clicked -- implement me!");
}

function onButton8Click() {
  var w = window.open("", "_blank");
  w.document.write(
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Random Dogs - ÖMER FARUK ÇELİK</title>' +
    '<style>' +
    'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f8fafc,#e2e8f0);margin:0;padding:24px;}' +
    '.card{max-width:640px;width:100%;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:48px 40px;text-align:center;}' +
    'h1{font-size:1.875rem;color:#1e293b;margin-bottom:8px;}' +
    '.desc{color:#64748b;line-height:1.5;margin-bottom:24px;}' +
    '#dog-img{max-width:100%;max-height:400px;border-radius:12px;margin-bottom:16px;display:none;}' +
    '#loading{color:#64748b;margin-bottom:16px;}' +
    '#error{color:#ef4444;margin-bottom:16px;display:none;}' +
    '.btn{padding:12px 24px;border:none;border-radius:12px;font-size:1rem;font-weight:500;cursor:pointer;margin:4px;}' +
    '.btn-primary{background:#4f46e5;color:#fff;}.btn-primary:hover{background:#4338ca;}' +
    '.btn-secondary{background:#e2e8f0;color:#1e293b;}.btn-secondary:hover{background:#cbd5e1;}' +
    '</style></head><body><div class="card">' +
    '<h1>Random Dog Images</h1>' +
    '<p class="desc">This page uses the <strong>Dog CEO API</strong> (dog.ceo/api), a free public API that serves random photos of dogs. Each click fetches a new random dog image from their collection.</p>' +
    '<p id="loading">Loading...</p>' +
    '<p id="error"></p>' +
    '<img id="dog-img" alt="Random dog" />' +
    '<div><button class="btn btn-primary" onclick="fetchDog()">New Dog</button> ' +
    '<button class="btn btn-secondary" onclick="window.close()">Back</button></div>' +
    '<script>' +
    'function fetchDog(){var img=document.getElementById("dog-img");var loading=document.getElementById("loading");var error=document.getElementById("error");loading.style.display="block";error.style.display="none";fetch("https://dog.ceo/api/breeds/image/random").then(function(r){return r.json()}).then(function(d){img.src=d.message;img.style.display="block";loading.style.display="none"}).catch(function(){loading.style.display="none";error.textContent="Failed to fetch. Try again.";error.style.display="block"});}fetchDog();' +
    '<\/script></div></body></html>'
  );
  w.document.close();
}
