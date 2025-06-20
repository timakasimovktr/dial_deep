ua.on("newRTCSession", function (e) {
  var session = e.session;
  var category_id;
  session.on("peerconnection", function (e) {
    session.on("accepted", function () {
      console.log("📞 Клиент поднял трубку");
      initializeAudioMixer(session); // ✅ Инициализация микшера сразу при старте

      playWavWithFakeMic("audio/salom.wav", session);

      fetch("http://192.168.1.183:8002/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "Start" }),
      }).then((response) => {
        if (!response.ok) throw new Error(`Не удалось отправить Start на сервер: ${response.status}`);
        console.log("Start успешно отправлен на сервер.");
      }).catch((error) => {
        console.error("Ошибка при отправке Start:", error);
      });
    });

    const pc = e.peerconnection;

    pc.addEventListener("track", function (event) {
      const remoteStream = event.streams[0];

      const audioElement = document.createElement("audio");
      audioElement.srcObject = remoteStream;
      audioElement.autoplay = true;
      document.body.appendChild(audioElement);

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(remoteStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const wsStream = new WebSocket("ws://192.168.1.183:8002/ws");
      wsStream.binaryType = "arraybuffer";

      wsStream.onopen = () => console.log("✅ WebSocket соединение открыто");
      wsStream.onclose = () => console.log("❌ WebSocket соединение закрыто");
      wsStream.onerror = (error) => console.error("⚠️ Ошибка WebSocket:", error);

      wsStream.onmessage = (event) => {
        const dataString = JSON.parse(event.data);
        if (dataString.status) {
          if(!dataString.category_id) return;
          if(category_id == dataString.category_id){
            category_id = dataString.category_id
            playWavWithFakeMic("audio/second/" + dataString.category_id + ".wav", session);
          } else {
            category_id = dataString.category_id
            playWavWithFakeMic("audio/" + dataString.category_id + ".wav", session);
          }
        } else {
          stopPlayingWavWithFakeMic();
        }
      };

      const audioContext2 = new AudioContext({ sampleRate: 16000 });
      const source2 = audioContext2.createMediaStreamSource(remoteStream);
      const processor = audioContext2.createScriptProcessor(4096, 1, 1);

      function createWavHeader(sampleRate, numFrames) {
        const header = new ArrayBuffer(44);
        const view = new DataView(header);

        writeString(view, 0, "RIFF");
        view.setUint32(4, 36 + numFrames * 2, true);
        writeString(view, 8, "WAVE");

        writeString(view, 12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true); // Mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);

        writeString(view, 36, "data");
        view.setUint32(40, numFrames * 2, true);

        return header;
      }

      function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      }

      let audioData = [];

      processor.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer.getChannelData(0);
        const int16Buffer = new Int16Array(inputBuffer.length);

        for (let i = 0; i < inputBuffer.length; i++) {
          let sample = inputBuffer[i];
          sample = Math.max(-1, Math.min(1, sample));
          int16Buffer[i] = sample * 32767;
        }

        audioData.push(...int16Buffer);

        if (wsStream.readyState === WebSocket.OPEN && audioData.length >= 16000) {
          const wavHeader = createWavHeader(16000, audioData.length);
          const wavBuffer = new Uint8Array(wavHeader.byteLength + audioData.length * 2);
          wavBuffer.set(new Uint8Array(wavHeader), 0);
          wavBuffer.set(new Uint8Array(new Int16Array(audioData).buffer), 44);

          wsStream.send(wavBuffer.buffer);
          audioData = [];
        }
      };

      source2.connect(processor);
      processor.connect(audioContext2.destination);

      console.log("🔊 Отправка аудио на сервер WebSocket в формате WAV 16-bit mono 16kHz");
    });
  });
});

document.getElementById("start-call").onclick = function () {
  var target = document.getElementById("target-number").value;
  if (target) {
    var options = { mediaConstraints: { audio: true, video: false } };
    ua.call(target, options);
  } else {
    alert("Пожалуйста, введите номер для звонка");
  }
};
