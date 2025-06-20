let mixerAudioContext = null;
let mixerDestination = null;
let sessionGlobal = null;
let currentAudioSource = null;
let backgroundSourceNode = null;

async function initializeAudioMixer(session) {
  if (mixerAudioContext) return;

  mixerAudioContext = new AudioContext();
  mixerDestination = mixerAudioContext.createMediaStreamDestination();
  sessionGlobal = session;

  // Фоновая музыка
  const bgResponse = await fetch("audio/background1.wav");
  if (!bgResponse.ok) throw new Error(`Не удалось загрузить фон: ${bgResponse.status}`);

  const bgArrayBuffer = await bgResponse.arrayBuffer();
  const bgAudioBuffer = await mixerAudioContext.decodeAudioData(bgArrayBuffer);

  backgroundSourceNode = mixerAudioContext.createBufferSource();
  backgroundSourceNode.buffer = bgAudioBuffer;
  backgroundSourceNode.loop = true;

  const backgroundGain = mixerAudioContext.createGain();
  backgroundGain.gain.value = 0.4; // Громкость фона

  backgroundSourceNode.connect(backgroundGain).connect(mixerDestination);
  backgroundGain.connect(mixerAudioContext.destination); // Чтобы слышать фон в динамиках

  backgroundSourceNode.start();
  console.log("🎵 Фоновая музыка запущена");

  // Подключаем объединённый поток к звонку
  const audioTrack = mixerDestination.stream.getAudioTracks()[0];
  if (audioTrack) {
    session.connection.getSenders().forEach((sender) => {
      if (sender.track && sender.track.kind === "audio") {
        sender.replaceTrack(audioTrack).catch((err) => {
          console.error("Ошибка замены трека микшера:", err);
        });
      }
    });
  }
}

async function playWavWithFakeMic(url, session) {
  try {
    await initializeAudioMixer(session);

    if (currentAudioSource) {
      currentAudioSource.stop();
      currentAudioSource.disconnect();
      currentAudioSource = null;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Не удалось загрузить ${url}: ${response.status}`);

    const arrayBuffer = await response.arrayBuffer();
    const decodedData = await mixerAudioContext.decodeAudioData(arrayBuffer);

    const source = mixerAudioContext.createBufferSource();
    source.buffer = decodedData;

    const gainNode = mixerAudioContext.createGain();
    gainNode.gain.value = 1.0;

    source.connect(gainNode).connect(mixerDestination);
    gainNode.connect(mixerAudioContext.destination); // Чтобы слышать основной звук в динамиках

    source.start();

    currentAudioSource = source;

    await fetch("http://192.168.1.183:8002/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "true" }),
    });

    source.onended = async () => {
      currentAudioSource = null;
      await fetch("http://192.168.1.183:8002/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "false" }),
      });
    };
  } catch (error) {
    console.error("Ошибка в playWavWithFakeMic:", error);
  }
}

async function stopPlayingWavWithFakeMic() {
  try {
    if (currentAudioSource) {
      currentAudioSource.stop();
      currentAudioSource.disconnect();
      currentAudioSource = null;
    }
  } catch (error) {
    console.error("Ошибка в stopPlayingWavWithFakeMic:", error);
  }
}
