// Logic

const randomStarterTrack = true;
const eventLoopRefreshMs = 50;
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Windows Phone|Opera Mini/i.test(navigator.userAgent);
history.scrollRestoration = "manual";

const player = document.getElementById("player");
const largeAlbumArtContainer = document.getElementById("large-album-art-container");
const largeAlbumArt = document.getElementById("large-album-art");
const progressBarBackground = document.getElementById("progress-bar-background");
const progressBar = document.getElementById("progress-bar");

let currentVolume = isMobile ? 1.0 : 0.5;
let shuffle = false;
let replay = false;
let custom = false;
let anchor = false;
let anchorScrollException = false;

let fullPlaylist = [];
let continuingTracks;
let fullPlaylistLength;
let currentTrackFullPlaylistIndex;
let currentTrack;
let currentTrackDuration = 0;
let currentTrackElapsed = 0;
let playlist = [];
let currentTrackIndex = -1;

let digitLogger = "";
let qsParams;
let uidMap = {};

init();
checkForStateChanges();

async function init() {
  const res = await fetch("./playlist.json");
  const tempPlaylist = await res.json();
  Object.keys(tempPlaylist).forEach(uid => {
    let track = tempPlaylist[uid];
    track["uid"] = uid;
    fullPlaylist.push(track);
  });
  fullPlaylistLength = Object.keys(fullPlaylist).length;
  continuingTracks = getContinuingTracks();

  for (let index in fullPlaylist) {
    uidMap[fullPlaylist[index]["uid"]] = index;
  }

  buildHTML();
  
  qsParams = parseQsParams();
  if (isNaN(qsParams.track) && qsParams.playlist.length == 0) {
    currentTrackFullPlaylistIndex = randomIndex() * randomStarterTrack;
  } else {
    if (!isNaN(qsParams.track)) {
      currentTrackFullPlaylistIndex = qsParams.track;
    }
    if (qsParams.playlist.length > 0) {
      if (!currentTrackFullPlaylistIndex) {
        currentTrackFullPlaylistIndex = qsParams.playlist[0];
      }
      setPlaylist(qsParams.playlist);
    }
    autoScroll();
  }

  currentTrack = fullPlaylist[currentTrackFullPlaylistIndex];
  playIndex(currentTrackFullPlaylistIndex);
}

function setupPlayer(track) {
  player.setAttribute("src", track["src"]);
  if (getFormatFromSrc(track["src"]) === "flac") {
    player.setAttribute("type", "audio/flac");
  } else {
    player.setAttribute("type", "audio/mp3");
  }
}

function getFormatFromSrc(src) {
  return src.match(/(?<=\.)[^?]{1,4}(?=\?)/)[0]
}

function checkForStateChanges() {
  setInterval(() => {
      if (currentTrack !== undefined) {
        currentTrackElapsed = 0;
        currentTrackDuration = 0;
        currentTrackElapsed = player.currentTime - seconds(currentTrack["start"]);
        updateCurrentTrackDuration();
        updateProgressBar();

        if (currentTrackElapsed > 0 &&
            currentTrackDuration > 0 &&
            currentTrackElapsed >= currentTrackDuration - 2*eventLoopRefreshMs/1000) {
          playNext(1, false);
        }
      }
    },
    eventLoopRefreshMs
  );
}

function playIndex(index, continuing = false, manual = false, updateState = true) {
  dehighlightCurrentTrack();
  currentTrackFullPlaylistIndex = index;
  updateCurrentTrackIndex();

  if (continuing && manual && currentTrackDuration - currentTrackElapsed > 2*eventLoopRefreshMs/1000) {
    seek(seconds(currentTrack["end"]));
  }

  if (continuing && replay) {
    seek(0);
  }

  currentTrack = fullPlaylist[currentTrackFullPlaylistIndex];
  if (!continuing) {
    muted = player.muted;
    player.pause();
    setupPlayer(currentTrack);
    changeVolume(0.0);
    player.muted = muted;
    player.play();
    seek(seconds(currentTrack["start"]));
  }
  
  if (updateState) {
    updateUrl();
  }
  updateDisplay();
  if (anchor) {
    autoScroll();
  }
}

function playNext(step = 1, manual = false) {
  let nextIndex = movedIndex(step);
  continuing = 
    step > 0 && 
    !shuffle && 
    nextIndex == currentTrackFullPlaylistIndex + 1 && 
    continuingTracks[currentTrackFullPlaylistIndex][0];
  playIndex(nextIndex, continuing, manual);
}

function movedIndex(step) {
  let index = currentTrackFullPlaylistIndex;
  if (!replay) {
    if (shuffle) {
      index = randomIndex();
    } else {
      if (playlist.length > 0) {
        index = playlist.length + currentTrackIndex + step;
        index %= playlist.length;
        index = playlist[index];
      } else {
        index += fullPlaylistLength + step;
        index %= fullPlaylistLength;
      }
    }
  }
  return index;
}

function togglePause() {
  if (player !== undefined) {
    if (!player.paused) {
      player.pause();
    } else {
      player.play();
    }
  }
}

function seek(second) {
  if (player !== undefined) {
    second = Math.max(second, seconds(currentTrack["start"]));
    player.pause();
    player.currentTime = second;
    player.play();
  }
}

function seekFraction(fraction) {
  seek(fraction * currentTrackDuration + seconds(currentTrack["start"]));
}

function skip(seconds) {
  seek(player.currentTime + seconds);
}

function seekLogged() {
  if (digitLogger) {
    seekFraction(parseFloat("0." + digitLogger));
  }
}

function restartCurrentTrack() {
  seek(0);
}

function changeVolume(volumeDelta) {
  currentVolume = Math.min(Math.max(currentVolume + volumeDelta, 0), 1);
  player.volume = currentVolume * (currentTrack["volume_multiplier"] ?? 1.0);
}

function playLogged() {
  setSelectedAsDigitLogger();
  if (digitLogger) {
    let index = Number(digitLogger) % fullPlaylistLength;
    replay = false;
    player.muted = false;
    playIndex(index, false, true);
  }
}

function playState() {
  qsParams = parseQsParams();
  if (!isNaN(qsParams.track) && qsParams.track != currentTrackFullPlaylistIndex) {
    replay = false;
    playIndex(qsParams.track, false, true, false);
  }
  setPlaylist(qsParams.playlist);
}

function toggleMute() {
  if (player !== undefined) {
    if (!player.muted) {
      player.muted = true;
    } else {
      player.muted = false;
    }
  }
}

function toggleShuffle() {
  shuffle = !shuffle;
}

function toggleReplay() {
  replay = !replay;
}

function toggleAnchor(e) {
  e.preventDefault();
  anchor = !anchor;
  autoScroll();
}

function updateCurrentTrackDuration() {
  currentTrackDuration = Math.max(seconds(currentTrack["end"]) - seconds(currentTrack["start"]), 0);
  currentTrackDuration += (player.duration - seconds(currentTrack["start"])) * (currentTrackDuration == 0);
  currentTrackDuration = Math.max(currentTrackDuration, 0);
}

function updateDigitLogger(key) {
  if (!(isNaN(Number(key)) || key === null || key === ' ')) {
    digitLogger += key;
  } else {
    digitLogger = "";
  }
}

function randomIndex() {
  if (playlist.length > 0) {
    return playlist[Math.floor(Math.random() * playlist.length)];
  }
  return Math.floor(Math.random() * fullPlaylistLength);
}

function updateCurrentTrackIndex() {
  let index = playlist.indexOf(currentTrackFullPlaylistIndex);
  if (index > -1) {
    currentTrackIndex = index;
  }
}

function getContinuingTracks() {
  let res = [];
  Object.keys(fullPlaylist).forEach((_, index) => {
    res[index] = [
      index < fullPlaylistLength - 1 && 
      fullPlaylist[index]["src"] == fullPlaylist[index+1]["src"] &&
      fullPlaylist[index]["end"] == fullPlaylist[index+1]["start"], 
      null
    ];
  });
  let last_seen_end = null;
  for (let i = fullPlaylistLength - 1; i >= 0; i--) {
    if (res[i][0]) {
        res[i][1] = last_seen_end;
    } else {
        last_seen_end = fullPlaylist[i]["end"]
    }
  }
  return res;
}

function deletePlaylist() {
  if (custom) {
    playlist = [];
    currentTrackIndex = -1;
    updateUrl();
    custom = false;
  }
}

function editPlaylist(trackIndex) {
  let index = playlist.indexOf(trackIndex);
  custom = true;
  if (index > -1) {
    playlist.splice(index, 1);
    if (playlist.length === 0) {
        custom = false;
    }
  } else {
    if (digitLogger) {
      index = Number(digitLogger) % playlist.length;
      playlist.splice(index, 0, trackIndex);
      currentTrackIndex = index;
    } else {
      playlist.push(trackIndex);
      currentTrackIndex = playlist.length - 1;
    }
  }
  updateDisplay();
  updateUrl();
}

function insertToPlaylist() {
  setSelectedAsDigitLogger();
  if (digitLogger) {
    let trackIndex = Number(digitLogger) % fullPlaylistLength;
    digitLogger = "";
    editPlaylist(trackIndex);
  } else {
    editPlaylist(currentTrackFullPlaylistIndex);
  }
}

function setPlaylist(newPlaylist) {
  custom = newPlaylist.length > 0;
  playlist = newPlaylist;
  updatePlaylistDisplay();
  currentTrackIndex = playlist.indexOf(currentTrackFullPlaylistIndex);
  if (custom && currentTrackIndex == -1) {
    currentTrackIndex = 0;
  }
}

function download(index) {
  const link = document.createElement("a");
  link.href = fullPlaylist[index]["src"].replace("&dl=0&raw=1", "&dl=1");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Interaction

document.addEventListener(
  "scroll", 
  (e) => {
    if (!anchorScrollException) {
      anchor = false;
      updateTitle();
    } else {
      anchorScrollException = false;
    }
  }
);

progressBarBackground.addEventListener(
  "click",
  (e) => {
    seekFraction(e.clientX/progressBarBackground.offsetWidth);
  }
);

largeAlbumArtContainer.setAttribute("onclick", "hideCover()");;

window.addEventListener("popstate", playState);
window.addEventListener("pushstate", playState);

document.addEventListener(
  "keydown",
  (e) => {
    // console.log(e.key);
    // console.log(e.code);
    let caseMatched = true;
    if (player !== undefined) {
      switch (e.code) {
        case "Enter":
          e.preventDefault();
          playLogged();
          break;
        case "Space":
          e.preventDefault();
          togglePause();
          break;
        case "KeyM":
          toggleMute();
          break;
        case "KeyZ":
          toggleShuffle();
          break;
        case "KeyX":
          toggleReplay();
          break;
        case "KeyR":
          restartCurrentTrack();
          break;
        case "KeyS":
          changeVolume(-0.05);
          break;
        case "KeyW":
          changeVolume(0.05);
          break;
        case "KeyA":
          playNext(-1, true);
          break;
        case "KeyD":
          playNext(1, true);
          break;
        case "KeyQ":
          skip(-5);
          break;
        case "KeyE":
          skip(5);
          break;
        case "KeyI":
          editPlaylist(currentTrackFullPlaylistIndex);
          updatePlaylistDisplay();
          break;
        case "KeyP":
          insertToPlaylist();
          updatePlaylistDisplay();
          break;
        case "Period":
          seekLogged();
          break;
        case "Tab":
          toggleAnchor(e);
          break;
        case "Backspace":
          digitLogger = "";
          break;
        case "Escape":
          deletePlaylist();
          updatePlaylistDisplay(true);
          break;
        default:
          caseMatched = false;
      }
      updateDigitLogger(e.key);
      if (caseMatched) {
        updateDisplay();
      }
    }
  },
  false
);

// Graphics

function buildHTML() {
  const tracklist = document.getElementById("tracklist");
  Object.keys(fullPlaylist).forEach(index => {
    const track = document.createElement("div");
    const coverPlaceholder = document.createElement("div");
    const albumArt = document.createElement("img");
    const trackIndex = document.createElement("p");
    const title = document.createElement("p");
    const albumArtists = document.createElement("p");
    const playlistIndex = document.createElement("p");
    const duration = document.createElement("p");
    const flac = document.createElement("p");
    const download = document.createElement("img");
    
    albumArt.classList.add("album-art");
    albumArt.setAttribute("src", `img/cover_art/${fullPlaylist[index]["art"].slice(0, -4)}_50.jpg`);
    albumArt.setAttribute("onclick", `showCover(${index})`);

    coverPlaceholder.classList.add("album-art-placeholder");
    coverPlaceholder.appendChild(albumArt);

    trackIndex.classList.add("index");
    trackIndex.innerHTML = index.padStart(4, "0");

    title.classList.add("title");
    title.classList.add("fade");
    title.setAttribute("title", fullPlaylist[index]["title"]);
    title.innerHTML = fullPlaylist[index]["title"];

    albumArtists.classList.add("album-artists");
    albumArtists.classList.add("fade");
    albumArtists.innerHTML = `${fullPlaylist[index]["album"]} - ${fullPlaylist[index]["artists"]}`;

    playlistIndex.classList.add("playlist-index");
    playlistIndex.innerHTML = "0000 |";

    duration.classList.add("duration");
    const trackDuration = trackDurationForDisplay(index);
    duration.innerHTML = trackDuration ? formattedParsedDuration(trackDuration) : "??:??";

    flac.classList.add("flac");
    if (getFormatFromSrc(fullPlaylist[index]["src"]) === "flac") {
      flac.innerHTML = "FLAC";
    }

    download.classList.add("download");
    download.setAttribute("src", "./img/download.svg");
    download.setAttribute("onclick", `download(${index})`);

    track.classList.add("track");
    track.classList.add("prevent-select");
    if (continuingTracks[index][0]) { track.classList.add("continuing"); }
    track.setAttribute("id", index);
    track.setAttribute(isMobile ? "onclick" : "ondblclick", `playIndex(${index})`);
    track.appendChild(coverPlaceholder);
    track.appendChild(trackIndex);
    track.appendChild(title);
    track.appendChild(albumArtists);
    track.appendChild(playlistIndex);
    track.appendChild(duration);
    track.appendChild(flac);
    track.appendChild(download);

    tracklist.appendChild(track);
  });
}

function showCover(index) {
  const cover_large_path = `img/cover_art/${fullPlaylist[index]["art"].slice(0, -4)}_440.jpg`;
  largeAlbumArt.setAttribute("src", cover_large_path);
  largeAlbumArt.style.opacity = "1";
  largeAlbumArtContainer.style.zIndex = "100";
}

function hideCover() {
  largeAlbumArt.style.opacity = "0";
  largeAlbumArtContainer.style.zIndex = "-2";
  largeAlbumArt.setAttribute("src", "");
}

function autoScroll() {
  anchorScrollException = true;
  window.scrollTo(0, window.scrollY + document.getElementById(currentTrackFullPlaylistIndex).getBoundingClientRect().top);
}

function highlightCurrentTrack() {
  document.getElementById(currentTrackFullPlaylistIndex).setAttribute("playing", "true");
}

function dehighlightCurrentTrack() {
  document.getElementById(currentTrackFullPlaylistIndex).setAttribute("playing", "false");
}

function updateDisplay() {
  updateTitle();
  updateProgressBar();
  highlightCurrentTrack();
}

function updateTitle() {
  let title = currentTrack["title"] + " - " + currentTrack["artists"];
  title += " | \u{1F50A}" + Math.round(100*currentVolume) + "%";
  title = "\u{1F507} ".repeat(player.muted) + title;
  title = "\u2693\uFE0F ".repeat(anchor) + title;
  title = "\u25B6\uFE0F ".repeat(!player.paused) + title;
  title = "\u23F8\uFE0F ".repeat(player.paused) + title;
  title = "\u{1F500} ".repeat(shuffle) + title;
  title = "\u{1F501} ".repeat(replay) + title;
  title = "\u{1F49F} ".repeat(custom) + title;
  document.title = title;
}

function updateUrl() {
  let paramsTrack = currentTrack["uid"];
  let paramsPlaylist = playlist.map(idx => fullPlaylist[idx]["uid"]).join(",");
  let qs = "?track=" + paramsTrack;
  if (paramsPlaylist) {
    qs += "&playlist=" + paramsPlaylist;
  }
  window.history.pushState(null, "", qs);
}

function seconds(time) {
  if (time === null || time === undefined) {
    return 0;
  }
  const [hours, minutes, secDecimals] = time.split(":");
  const [sec, decimals] = secDecimals.split(".");
  let totalSeconds = +hours * 3600 + +minutes * 60 + +sec
  if (decimals) {
    totalSeconds += +decimals/10**decimals.length;
  }
  return totalSeconds;
}

function trackDurationForDisplay(index) {
  let displayDuration = Math.max(seconds(fullPlaylist[index]["end"]) - seconds(fullPlaylist[index]["start"]), 0);
  displayDuration += (seconds(fullPlaylist[index]["duration"]) - seconds(fullPlaylist[index]["start"])) * (displayDuration == 0);
  return displayDuration;
}

function updateProgressBar() {
  let progress = Math.min(currentTrackElapsed/currentTrackDuration, 1);
  progressBar.style.width = `${100*progress}%`;
}

function parseDuration(seconds) {
  seconds = Math.floor(seconds)
  let perDay = 60*60*24;
  let perHr = 60*60;
  let perMin = 60;
  let days = Math.floor(seconds / perDay);
  seconds -= days*perDay;
  let hours = Math.floor(seconds / perHr);
  seconds -= hours*perHr;
  let minutes = Math.floor(seconds / perMin);
  seconds -= minutes*perMin;
  return [days, hours, minutes, seconds];
}

function formattedParsedDuration(totalSeconds) {
  let [days, hours, minutes, seconds] = parseDuration(totalSeconds);
  minutes = minutes + 60*hours + 24*60*days;
  return minutes.toString().padStart(2, '0') + ":" + seconds.toString().padStart(2, '0');
}

function updatePlaylistDisplay(clear = false) {
  let track;
  let indexDisplay;
  Object.keys(fullPlaylist).forEach(index => {
    track = document.getElementById(index);
    indexDisplay = track.querySelector(".playlist-index");
    track.setAttribute("playlist", "false");
    indexDisplay.innerHTML = "0000 |";
  });
  if (!clear) {
    for (let [trackIndex, index] of playlist.entries()) {
      track = document.getElementById(index);
      indexDisplay = track.querySelector(".playlist-index");
      track.setAttribute("playlist", "true");
      indexDisplay.innerHTML = `${trackIndex.toString().padStart(4, '0') + " |"}`;
    }
  }
}

function parseQsParams() {
  let params = new URLSearchParams(window.location.href.split("?").pop());
  let paramsTrack = NaN;
  let paramsPlaylist = [];
  if (params.has("track")) {
    let input = params.get("track");
    paramsTrack = Number(uidMap[input] ?? input) % fullPlaylistLength;
  }
  if (params.has("playlist")) {
    paramsPlaylist = [...new Set(params.get("playlist").split(",").map((input) => Number(uidMap[input] ?? input) % fullPlaylistLength).filter((input) => !isNaN(input)))]
  }
  return {
    track: paramsTrack,
    playlist: paramsPlaylist
  };
}

function isNumeric(value) {
  return /^-?\d+$/.test(value);
}

function getSelected() {
  try {
    let selected = document.getSelection().focusNode.parentNode.parentNode.id;
    if (isNumeric(selected)) {
      return selected;
    }
  } catch {}
}

function setSelectedAsDigitLogger() {
  let selected = getSelected();
  if (!digitLogger && selected != undefined) {
    digitLogger = selected;
  }
}
