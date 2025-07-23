var beepbox = (function (exports) {
    'use strict';

    function scaleElementsByFactor(array, factor) {
        for (let i = 0; i < array.length; i++) {
            array[i] *= factor;
        }
    }
    function isPowerOf2(n) {
        return !!n && !(n & (n - 1));
    }
    function countBits(n) {
        if (!isPowerOf2(n))
            throw new Error("FFT array length must be a power of 2.");
        return Math.round(Math.log(n) / Math.log(2));
    }
    function reverseIndexBits(array) {
        const fullArrayLength = array.length;
        const bitCount = countBits(fullArrayLength);
        if (bitCount > 16)
            throw new Error("FFT array length must not be greater than 2^16.");
        const finalShift = 16 - bitCount;
        for (let i = 0; i < fullArrayLength; i++) {
            let j;
            j = ((i & 0xaaaa) >> 1) | ((i & 0x5555) << 1);
            j = ((j & 0xcccc) >> 2) | ((j & 0x3333) << 2);
            j = ((j & 0xf0f0) >> 4) | ((j & 0x0f0f) << 4);
            j = ((j >> 8) | ((j & 0xff) << 8)) >> finalShift;
            if (j > i) {
                let temp = array[i];
                array[i] = array[j];
                array[j] = temp;
            }
        }
    }
    function inverseRealFourierTransform(array) {
        const fullArrayLength = array.length;
        const totalPasses = countBits(fullArrayLength);
        if (fullArrayLength < 4)
            throw new Error("FFT array length must be at least 4.");
        for (let pass = totalPasses - 1; pass >= 2; pass--) {
            const subStride = 1 << pass;
            const midSubStride = subStride >> 1;
            const stride = subStride << 1;
            const radiansIncrement = Math.PI * 2.0 / stride;
            const cosIncrement = Math.cos(radiansIncrement);
            const sinIncrement = Math.sin(radiansIncrement);
            const oscillatorMultiplier = 2.0 * cosIncrement;
            for (let startIndex = 0; startIndex < fullArrayLength; startIndex += stride) {
                const startIndexA = startIndex;
                const midIndexA = startIndexA + midSubStride;
                const startIndexB = startIndexA + subStride;
                const midIndexB = startIndexB + midSubStride;
                const stopIndex = startIndexB + subStride;
                const realStartA = array[startIndexA];
                const imagStartB = array[startIndexB];
                array[startIndexA] = realStartA + imagStartB;
                array[midIndexA] *= 2;
                array[startIndexB] = realStartA - imagStartB;
                array[midIndexB] *= 2;
                let c = cosIncrement;
                let s = -sinIncrement;
                let cPrev = 1.0;
                let sPrev = 0.0;
                for (let index = 1; index < midSubStride; index++) {
                    const indexA0 = startIndexA + index;
                    const indexA1 = startIndexB - index;
                    const indexB0 = startIndexB + index;
                    const indexB1 = stopIndex - index;
                    const real0 = array[indexA0];
                    const real1 = array[indexA1];
                    const imag0 = array[indexB0];
                    const imag1 = array[indexB1];
                    const tempA = real0 - real1;
                    const tempB = imag0 + imag1;
                    array[indexA0] = real0 + real1;
                    array[indexA1] = imag1 - imag0;
                    array[indexB0] = tempA * c - tempB * s;
                    array[indexB1] = tempB * c + tempA * s;
                    const cTemp = oscillatorMultiplier * c - cPrev;
                    const sTemp = oscillatorMultiplier * s - sPrev;
                    cPrev = c;
                    sPrev = s;
                    c = cTemp;
                    s = sTemp;
                }
            }
        }
        for (let index = 0; index < fullArrayLength; index += 4) {
            const index1 = index + 1;
            const index2 = index + 2;
            const index3 = index + 3;
            const real0 = array[index];
            const real1 = array[index1] * 2;
            const imag2 = array[index2];
            const imag3 = array[index3] * 2;
            const tempA = real0 + imag2;
            const tempB = real0 - imag2;
            array[index] = tempA + real1;
            array[index1] = tempA - real1;
            array[index2] = tempB + imag3;
            array[index3] = tempB - imag3;
        }
        reverseIndexBits(array);
    }

    /*!
    Copyright (c) 2012-2022 John Nesky and contributing authors

    Permission is hereby granted, free of charge, to any person obtaining a copy of
    this software and associated documentation files (the "Software"), to deal in
    the Software without restriction, including without limitation the rights to
    use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
    of the Software, and to permit persons to whom the Software is furnished to do
    so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
    */
    class Config {
        static _centerWave(wave) {
            let sum = 0.0;
            for (let i = 0; i < wave.length; i++)
                sum += wave[i];
            const average = sum / wave.length;
            for (let i = 0; i < wave.length; i++)
                wave[i] -= average;
            return new Float64Array(wave);
        }
        static getDrumWave(index) {
            let wave = Config._drumWaves[index];
            if (wave == null) {
                wave = new Float32Array(32768);
                Config._drumWaves[index] = wave;
                if (index == 0) {
                    let drumBuffer = 1;
                    for (let i = 0; i < 32768; i++) {
                        wave[i] = (drumBuffer & 1) * 2.0 - 1.0;
                        let newBuffer = drumBuffer >> 1;
                        if (((drumBuffer + newBuffer) & 1) == 1) {
                            newBuffer += 1 << 14;
                        }
                        drumBuffer = newBuffer;
                    }
                }
                else if (index == 1) {
                    for (let i = 0; i < 32768; i++) {
                        wave[i] = Math.random() * 2.0 - 1.0;
                    }
                }
                else if (index == 2) {
                    let drumBuffer = 1;
                    for (let i = 0; i < 32768; i++) {
                        wave[i] = (drumBuffer & 1) * 2.0 - 1.0;
                        let newBuffer = drumBuffer >> 1;
                        if (((drumBuffer + newBuffer) & 1) == 1) {
                            newBuffer += 2 << 14;
                        }
                        drumBuffer = newBuffer;
                    }
                }
                else if (index == 3) {
                    let drumBuffer = 1;
                    for (let i = 0; i < 32767; i++) {
                        wave[i] = (drumBuffer & 1) * 2.0 - 1.0;
                        let newBuffer = drumBuffer >> 2;
                        if (((drumBuffer + newBuffer) & 1) == 1) {
                            newBuffer += 4 << 14;
                        }
                        drumBuffer = newBuffer;
                    }
                }
                else if (index == 4) {
                    let drumBuffer = 1;
                    for (let i = 0; i < 32768; i++) {
                        wave[i] = (drumBuffer & 1) * 2.0 - 1.0;
                        let newBuffer = drumBuffer >> 1;
                        if (((drumBuffer + newBuffer) & 1) == 1) {
                            newBuffer += 10 << 2;
                        }
                        drumBuffer = newBuffer;
                    }
                }
                else if (index == 5) {
                    Config.drawNoiseSpectrum(wave, 10, 11, 1, 1, 0);
                    Config.drawNoiseSpectrum(wave, 11, 14, -2, -2, 0);
                    inverseRealFourierTransform(wave);
                    scaleElementsByFactor(wave, 1.0 / Math.sqrt(wave.length));
                }
                else if (index == 6) {
                    Config.drawNoiseSpectrum(wave, 1, 10, 1, 1, 0);
                    Config.drawNoiseSpectrum(wave, 20, 14, -2, -2, 0);
                    inverseRealFourierTransform(wave);
                    scaleElementsByFactor(wave, 1.0 / Math.sqrt(wave.length));
                }
                else if (index == 7) {
                    let drumBuffer = 1;
                    for (let i = 0; i < 32768; i++) {
                        wave[i] = (drumBuffer & 1) * 4.0 * Math.random();
                        let newBuffer = drumBuffer >> 1;
                        if (((drumBuffer + newBuffer) & 1) == 1) {
                            newBuffer += 15 << 2;
                        }
                        drumBuffer = newBuffer;
                    }
                }
                else if (index == 8) {
                    let drumBuffer = 1;
                    for (let i = 0; i < 32768; i++) {
                        wave[i] = (drumBuffer & 1) / 2.0 + 0.5;
                        let newBuffer = drumBuffer >> 1;
                        if (((drumBuffer + newBuffer) & 1) == 1) {
                            newBuffer -= 10 << 2;
                        }
                        drumBuffer = newBuffer;
                    }
                }
                else if (index == 9) {
                    for (let i = 0; i < 32768; i++) {
                        wave[i] = Math.random() * 2.0 - 1.0;
                    }
                }
                else {
                    throw new Error("Unrecognized drum index: " + index);
                }
            }
            return wave;
        }
        static drawNoiseSpectrum(wave, lowOctave, highOctave, lowPower, highPower, overalSlope) {
            const referenceOctave = 11;
            const referenceIndex = 1 << referenceOctave;
            const lowIndex = Math.pow(2, lowOctave) | 0;
            const highIndex = Math.pow(2, highOctave) | 0;
            const log2 = Math.log(2);
            for (let i = lowIndex; i < highIndex; i++) {
                let amplitude = Math.pow(2, lowPower + (highPower - lowPower) * (Math.log(i) / log2 - lowOctave) / (highOctave - lowOctave));
                amplitude *= Math.pow(i / referenceIndex, overalSlope);
                const radians = Math.random() * Math.PI * 2.0;
                wave[i] = Math.cos(radians) * amplitude;
                wave[32768 - i] = Math.sin(radians) * amplitude;
            }
        }
        static generateSineWave() {
            const wave = new Float64Array(Config.sineWaveLength + 1);
            for (let i = 0; i < Config.sineWaveLength + 1; i++) {
                wave[i] = Math.sin(i * Math.PI * 2.0 / Config.sineWaveLength);
            }
            return wave;
        }
    }
    Config.scales = toNameMap([
        { name: "easy :)", realName: "pentatonic major", flags: [true, false, true, false, true, false, false, true, false, true, false, false] },
        { name: "easy :(", realName: "pentatonic minor", flags: [true, false, false, true, false, true, false, true, false, false, true, false] },
        { name: "island :)", realName: "ryukyu", flags: [true, false, false, false, true, true, false, true, false, false, false, true] },
        { name: "island :(", realName: "pelog selisir", flags: [true, true, false, true, false, false, false, true, true, false, false, false] },
        { name: "blues :)", realName: "blues major", flags: [true, false, true, true, true, false, false, true, false, true, false, false] },
        { name: "blues :(", realName: "blues", flags: [true, false, false, true, false, true, true, true, false, false, true, false] },
        { name: "normal :)", realName: "ionian", flags: [true, false, true, false, true, true, false, true, false, true, false, true] },
        { name: "normal :(", realName: "aeolian", flags: [true, false, true, true, false, true, false, true, true, false, true, false] },
        { name: "dbl harmonic :)", realName: "double harmonic major", flags: [true, true, false, false, true, true, false, true, true, false, false, true] },
        { name: "dbl harmonic :(", realName: "double harmonic minor", flags: [true, false, true, true, false, false, true, true, true, false, false, true] },
        { name: "enigma", realName: "whole tone", flags: [true, false, true, false, true, false, true, false, true, false, true, false] },
        { name: "expert", realName: "chromatic", flags: [true, true, true, true, true, true, true, true, true, true, true, true] },
        { name: "monotonic", realName: "monotonic", flags: [true, false, false, false, false, false, false, false, false, false, false, false] },
        { name: "no dabbing", realName: "no dabbing", flags: [true, true, false, true, true, true, true, true, true, false, true, false] },
    ]);
    Config.blackKeyNameParents = [-1, 1, -1, 1, -1, 1, -1, -1, 1, -1, 1, -1];
    Config.pitchNames = ["C", null, "D", null, "E", "F", null, "G", null, "A", null, "B"];
    Config.oldKeys = ["B", "A♯", "A", "G♯", "F♯", "F", "E", "D♯", "D", "C♯", "C"];
    Config.keys = toNameMap([
        { name: "C", isWhiteKey: true, basePitch: 12 },
        { name: "C♯", isWhiteKey: false, basePitch: 13 },
        { name: "D", isWhiteKey: true, basePitch: 14 },
        { name: "D♯", isWhiteKey: false, basePitch: 15 },
        { name: "E", isWhiteKey: true, basePitch: 16 },
        { name: "F", isWhiteKey: true, basePitch: 17 },
        { name: "F♯", isWhiteKey: false, basePitch: 18 },
        { name: "G", isWhiteKey: true, basePitch: 19 },
        { name: "G♯", isWhiteKey: false, basePitch: 20 },
        { name: "A", isWhiteKey: true, basePitch: 21 },
        { name: "A♯", isWhiteKey: false, basePitch: 22 },
        { name: "B", isWhiteKey: true, basePitch: 23 },
    ]);
    Config.mixNames = ["Type A (B & S)", "Type B (M)", "Type C"];
    Config.sampleRateNames = ["44100kHz", "48000kHz", "default", "×4", "×2", "÷2", "÷4", "÷8", "÷16"];
    Config.tempoSteps = 24;
    Config.reverbRange = 5;
    Config.blendRange = 4;
    Config.riffRange = 11;
    Config.detuneRange = 24;
    Config.muffRange = 24;
    Config.beatsPerBarMin = 1;
    Config.beatsPerBarMax = 24;
    Config.barCountMin = 1;
    Config.barCountMax = 256;
    Config.patternsPerChannelMin = 1;
    Config.patternsPerChannelMax = 64;
    Config.instrumentsPerChannelMin = 1;
    Config.instrumentsPerChannelMax = 64;
    Config.pitchesPerOctave = 12;
    Config.drumCount = 12;
    Config.pitchOctaves = 7;
    Config.partNames = ["÷3 (triplets)", "÷4 (standard)", "÷6", "÷8", "÷16 (arpfest)", "÷12", "÷9", "÷5", "÷50", "÷24"];
    Config.partCounts = [3, 4, 6, 8, 16, 12, 9, 5, 50, 24];
    Config.waveNames = ["triangle", "square", "pulse wide", "pulse narrow", "sawtooth", "double saw", "double pulse", "spiky", "plateau", "glitch", "10% pulse", "sunsoft bass", "loud pulse", "sax", "guitar", "sine", "atari bass", "atari pulse", "1% pulse", "curved sawtooth", "viola", "brass", "acoustic bass", "lyre", "ramp pulse", "piccolo", "squaretooth", "flatline", "pnryshk a (u5)", "pnryshk b (riff)"];
    Config.waveVolumes = [1.0, 0.5, 0.5, 0.5, 0.65, 0.5, 0.4, 0.4, 0.94, 0.5, 0.5, 1.0, 0.6, 0.1, 0.25, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.2, 0.2, 0.9, 0.9, 1.0, 0.4, 0.5];
    Config.drumNames = ["retro", "white", "periodic", "detuned periodic", "shine", "hollow", "deep", "cutter", "metallic", "snare"];
    Config.drumVolumes = [0.25, 1.0, 0.4, 0.3, 0.3, 1.5, 1.5, 0.25, 1.0, 1.0];
    Config.drumBasePitches = [69, 69, 69, 69, 69, 96, 120, 96, 96, 69];
    Config.drumPitchFilterMult = [100.0, 8.0, 100.0, 100.0, 100.0, 1.0, 100.0, 100.0, 100.0, 100.0];
    Config.drumWaveIsSoft = [false, true, false, false, false, true, true, false, false, false];
    Config._drumWaves = [null, null, null, null, null, null, null, null, null, null];
    Config.pwmwaveNames = ["5%", "10%", "15%", "20%", "25%", "30%", "35%", "40%", "45%", "50%"];
    Config.pwmwaveVolumes = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0];
    Config.filterNames = ["none", "sustain sharp", "sustain medium", "sustain soft", "decay sharp", "decay medium", "decay soft", "decay drawn", "fade sharp", "fade medium", "fade soft", "ring", "muffled", "submerged", "shift", "overtone", "woosh", "undertone"];
    Config.filterBases = [0.0, 2.0, 3.5, 5.0, 1.0, 2.5, 4.0, 1.0, 5.0, 7.5, 10.0, -1.0, 4.0, 6.0, 0.0, 1.0, 2.0, 5.0];
    Config.filterDecays = [0.0, 0.0, 0.0, 0.0, 10.0, 7.0, 4.0, 0.5, -10.0, -7.0, -4.0, 0.2, 0.2, 0.3, 0.0, 0.0, -6.0, 0.0];
    Config.filterVolumes = [0.2, 0.4, 0.7, 1.0, 0.5, 0.75, 1.0, 0.5, 0.4, 0.7, 1.0, 0.5, 0.75, 0.4, 0.4, 1.0, 0.5, 1.75];
    Config.transitionNames = ["seamless", "sudden", "smooth", "slide", "trill", "click", "bow", "blip"];
    Config.effectNames = ["none", "vibrato light", "vibrato delayed", "vibrato heavy", "tremolo light", "tremolo heavy", "alien", "stutter", "strum"];
    Config.effectVibratos = [0.0, 0.15, 0.3, 0.45, 0.0, 0.0, 1.0, 0.0, 0.05];
    Config.effectTremolos = [0.0, 0.0, 0.0, 0.0, 0.25, 0.5, 0.0, 1.0, 0.025];
    Config.effectVibratoDelays = [0, 0, 3, 0, 0, 0, 0, 0];
    Config.chorusNames = ["union", "shimmer", "hum", "honky tonk", "dissonant", "fifths", "octaves", "spinner", "detune", "bowed", "rising", "vibrate", "fourths", "bass", "dirty", "stationary", "harmonic (legacy)", "recurve", "voiced", "fluctuate"];
    Config.chorusIntervals = [0.0, 0.02, 0.05, 0.1, 0.25, 3.5, 6, 0.02, 0.0, 0.02, 1.0, 3.5, 4, 0, 0.0, 3.5, 0.0, 0.005, 0.25, 12];
    Config.chorusOffsets = [0.0, 0.0, 0.0, 0.0, 0.0, 3.5, 6, 0.0, 0.25, 0.0, 0.7, 7, 4, -7, 0.1, 0.0, 0.0, 0.0, 3.0, 0.0];
    Config.chorusVolumes = [0.9, 0.9, 1.0, 1.0, 0.95, 0.95, 0.9, 1.0, 1.0, 1.0, 0.95, 0.975, 0.95, 1.0, 0.975, 0.9, 1.0, 1.0, 0.9, 1.0];
    Config.chorusSigns = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, -1.0, 1.0, 1.0];
    Config.chorusRiffApp = [0.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0];
    Config.chorusHarmonizes = [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false];
    Config.harmDisplay = ["arpeggio", "duet", "chord", "seventh", "half arpeggio", "arp-chord"];
    Config.harmNames = [0, 1, 2, 3, 4, 5];
    Config.fmChorusDisplay = ["none", "default", "detune", "honky tonk", "consecutive", "alt. major thirds", "alt. minor thirds", "fifths", "octaves"];
    Config.fmChorusNames = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    Config.imuteNames = ["◉", "◎"];
    Config.imuteValues = [1, 0];
    Config.octoffNames = ["none", "+2 (2 octaves)", "+1 1/2 (octave and fifth)", "+1 (octave)", "+1/2 (fifth)", "-1/2 (fifth)", "-1 (octave)", "-1 1/2 (octave and fifth)", "-2 (2 octaves"];
    Config.octoffValues = [0.0, 24.0, 19.0, 12.0, 7.0, -7.0, -12.0, -19.0, -24.0];
    Config.volumeNames = ["loudest", "loud", "medium", "quiet", "quietest", "mute", "i", "couldnt", "be", "bothered"];
    Config.volumeValues = [0.0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, -1.0];
    Config.volumeMValues = [0.0, 0.5, 1.0, 1.5, 2.0, -1.0];
    Config.ipanValues = [-1.0, -0.75, -0.5, -0.25, 0.0, 0.25, 0.5, 0.75, 1.0];
    Config.operatorCount = 4;
    Config.operatorAlgorithmNames = [
        "1←(2 3 4)",
        "1←(2 3←4)",
        "1←2←(3 4)",
        "1←(2 3)←4",
        "1←2←3←4",
        "1←3 2←4",
        "1 2←(3 4)",
        "1 2←3←4",
        "(1 2)←3←4",
        "(1 2)←(3 4)",
        "1 2 3←4",
        "(1 2 3)←4",
        "1 2 3 4",
    ];
    Config.midiAlgorithmNames = ["1<(2 3 4)", "1<(2 3<4)", "1<2<(3 4)", "1<(2 3)<4", "1<2<3<4", "1<3 2<4", "1 2<(3 4)", "1 2<3<4", "(1 2)<3<4", "(1 2)<(3 4)", "1 2 3<4", "(1 2 3)<4", "1 2 3 4"];
    Config.operatorModulatedBy = [
        [[2, 3, 4], [], [], []],
        [[2, 3], [], [4], []],
        [[2], [3, 4], [], []],
        [[2, 3], [4], [4], []],
        [[2], [3], [4], []],
        [[3], [4], [], []],
        [[], [3, 4], [], []],
        [[], [3], [4], []],
        [[3], [3], [4], []],
        [[3, 4], [3, 4], [], []],
        [[], [], [4], []],
        [[4], [4], [4], []],
        [[], [], [], []],
    ];
    Config.operatorAssociatedCarrier = [
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 2, 1, 2],
        [1, 2, 2, 2],
        [1, 2, 2, 2],
        [1, 2, 2, 2],
        [1, 2, 2, 2],
        [1, 2, 3, 3],
        [1, 2, 3, 3],
        [1, 2, 3, 4],
    ];
    Config.operatorCarrierCounts = [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 4];
    Config.operatorCarrierChorus = [
        [0.0, 0.0, 0.0, 0.0],
        [0.0, 0.04, -0.073, 0.091],
        [0.5, 0.54, 0.427, 0.591],
        [0.0, 0.26, -0.45, 0.67],
        [0.0, 1.0, 2.0, 3.0],
        [0.0, 4.0, 7.0, 11.0],
        [0.0, 3.0, 7.0, 10.0],
        [0.0, 7.0, 14.0, 21.0],
        [0.0, 12.0, 24.0, 36.0],
    ];
    Config.operatorAmplitudeMax = 15;
    Config.operatorFrequencyNames = ["1×", "~1×", "2×", "~2×", "3×", "4×", "5×", "6×", "7×", "8×", "9×", "10×", "11×", "13×", "16×", "20×"];
    Config.midiFrequencyNames = ["1x", "~1x", "2x", "~2x", "3x", "4x", "5x", "6x", "7x", "8x", "9x", "10x", "11x", "13x", "16x", "20x"];
    Config.operatorFrequencies = [1.0, 1.0, 2.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 13.0, 16.0, 20.0];
    Config.operatorHzOffsets = [0.0, 1.5, 0.0, -1.3, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
    Config.operatorAmplitudeSigns = [1.0, -1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0];
    Config.operatorEnvelopeNames = ["custom", "steady", "punch", "flare 1", "flare 2", "flare 3", "pluck 1", "pluck 2", "pluck 3", "swell 1", "swell 2", "swell 3", "tremolo1", "tremolo2", "tremolo3", "custom flare", "custom tremolo", "flute 1", "flute 2", "flute 3"];
    Config.operatorEnvelopeType = [0, 1, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 3, 5, 6, 6, 6];
    Config.operatorSpecialCustomVolume = [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, true, true, false, false, false];
    Config.operatorEnvelopeSpeed = [0.0, 0.0, 0.0, 32.0, 8.0, 2.0, 32.0, 8.0, 2.0, 32.0, 8.0, 2.0, 4.0, 2.0, 1.0, 8.0, 0.0, 16.0, 8.0, 4.0];
    Config.operatorEnvelopeInverted = [false, false, false, false, false, false, false, false, false, true, true, true, false, false, false, false, false, false, false, false];
    Config.operatorFeedbackNames = [
        "1⟲",
        "2⟲",
        "3⟲",
        "4⟲",
        "1⟲ 2⟲",
        "3⟲ 4⟲",
        "1⟲ 2⟲ 3⟲ ",
        "2⟲ 3⟲ 4⟲ ",
        "1⟲ 2⟲ 3⟲ 4⟲ ",
        "1→2",
        "1→3",
        "1→4",
        "2→3",
        "2→4",
        "3→4",
        "1→3 2→4",
        "1→4 2→3",
        "1→2→3→4",
        "1🗘2",
        "1🗘3",
        "1🗘4",
        "2🗘3",
        "2🗘4",
        "3🗘4",
    ];
    Config.midiFeedbackNames = [
        "1",
        "2",
        "3",
        "4",
        "1 2",
        "3 4",
        "1 2 3",
        "2 3 4",
        "1 2 3 4",
        "1>2",
        "1>3",
        "1>4",
        "2>3",
        "2>4",
        "3>4",
        "1>3 2>4",
        "1>4 2>3",
        "1>2>3>4",
        "1-2",
        "1-3",
        "1-4",
        "2-3",
        "2-4",
        "3-4",
    ];
    Config.operatorFeedbackIndices = [
        [[1], [], [], []],
        [[], [2], [], []],
        [[], [], [3], []],
        [[], [], [], [4]],
        [[1], [2], [], []],
        [[], [], [3], [4]],
        [[1], [2], [3], []],
        [[], [2], [3], [4]],
        [[1], [2], [3], [4]],
        [[], [1], [], []],
        [[], [], [1], []],
        [[], [], [], [1]],
        [[], [], [2], []],
        [[], [], [], [2]],
        [[], [], [], [3]],
        [[], [], [1], [2]],
        [[], [], [2], [1]],
        [[], [1], [2], [3]],
        [[2], [1], [], []],
        [[3], [], [1], []],
        [[4], [], [], [1]],
        [[], [3], [2], []],
        [[], [4], [], [2]],
        [[], [], [4], [3]],
    ];
    Config.pitchChannelTypeNames = ["chip", "FM (expert)", "PWM (beta)"];
    Config.pitchChannelTypeValues = [0, 1, 3];
    Config.drumChannelTypeNames = ["noise"];
    Config.instrumentTypeNames = ["chip", "FM", "noise", "PWM"];
    Config.oldThemeNames = ["Default", "ModBox 2.0", "Artic", "Cinnamon Roll [!]", "Ocean", "Rainbow [!]", "Float [!]", "Windows", "Grassland", "Dessert", "Kahootiest", "Beam to the Bit [!]", "Pretty Egg", "Poniryoshka", "Gameboy [!]", "Woodkid", "Midnight", "Snedbox", "unnamed", "Piano [!] [↻]", "Halloween", "FrozenOver❄️"];
    Config.channelOneBrightColorPallet = "#25f3ff";
    Config.channelTwoBrightColorPallet = "#44ff44";
    Config.channelThreeBrightColorPallet = "#ffff25";
    Config.channelFourBrightColorPallet = "#ff9752";
    Config.channelFiveBrightColorPallet = "#ff90ff";
    Config.channelSixBrightColorPallet = "#9f31ea";
    Config.channelSevenBrightColorPallet = "#2b6aff";
    Config.channelEightBrightColorPallet = "#00ff9f";
    Config.channelNineBrightColorPallet = "#ffbf00";
    Config.channelTenBrightColorPallet = "#d85d00";
    Config.channelElevenBrightColorPallet = "#ff00a1";
    Config.channelTwelveBrightColorPallet = "#c26afc";
    Config.channelThirteenBrightColorPallet = "#ff1616";
    Config.channelFourteenBrightColorPallet = "#ffffff";
    Config.channelFifteenBrightColorPallet = "#768dfc";
    Config.channelSixteenBrightColorPallet = "#a5ff00";
    Config.channelOneDimColorPallet = "#0099a1";
    Config.channelTwoDimColorPallet = "#439143";
    Config.channelThreeDimColorPallet = "#a1a100";
    Config.channelFourDimColorPallet = "#c75000";
    Config.channelFiveDimColorPallet = "#d020d0";
    Config.channelSixDimColorPallet = "#552377";
    Config.channelSevenDimColorPallet = "#221b89";
    Config.channelEightDimColorPallet = "#00995f";
    Config.channelNineDimColorPallet = "#d6b03e";
    Config.channelTenDimColorPallet = "#b25915";
    Config.channelElevenDimColorPallet = "#891a60";
    Config.channelTwelveDimColorPallet = "#965cbc";
    Config.channelThirteenDimColorPallet = "#991010";
    Config.channelFourteenDimColorPallet = "#aaaaaa";
    Config.channelFifteenDimColorPallet = "#5869BD";
    Config.channelSixteenDimColorPallet = "#7c9b42";
    Config.pitchChannelColorsDim = [Config.channelOneDimColorPallet, Config.channelTwoDimColorPallet, Config.channelThreeDimColorPallet, Config.channelFourDimColorPallet, Config.channelFiveDimColorPallet, Config.channelSixDimColorPallet, Config.channelSevenDimColorPallet, Config.channelEightDimColorPallet, Config.channelNineDimColorPallet, Config.channelTenDimColorPallet, Config.channelElevenDimColorPallet, Config.channelTwelveDimColorPallet];
    Config.pitchChannelColorsBright = [Config.channelOneBrightColorPallet, Config.channelTwoBrightColorPallet, Config.channelThreeBrightColorPallet, Config.channelFourBrightColorPallet, Config.channelFiveBrightColorPallet, Config.channelSixBrightColorPallet, Config.channelSevenBrightColorPallet, Config.channelEightBrightColorPallet, Config.channelNineBrightColorPallet, Config.channelTenBrightColorPallet, Config.channelElevenBrightColorPallet, Config.channelTwelveBrightColorPallet];
    Config.pitchNoteColorsDim = [Config.channelOneDimColorPallet, Config.channelTwoDimColorPallet, Config.channelThreeDimColorPallet, Config.channelFourDimColorPallet, Config.channelFiveDimColorPallet, Config.channelSixDimColorPallet, Config.channelSevenDimColorPallet, Config.channelEightDimColorPallet, Config.channelNineDimColorPallet, Config.channelTenDimColorPallet, Config.channelElevenDimColorPallet, Config.channelTwelveDimColorPallet];
    Config.pitchNoteColorsBright = [Config.channelOneBrightColorPallet, Config.channelTwoBrightColorPallet, Config.channelThreeBrightColorPallet, Config.channelFourBrightColorPallet, Config.channelFiveBrightColorPallet, Config.channelSixBrightColorPallet, Config.channelSevenBrightColorPallet, Config.channelEightBrightColorPallet, Config.channelNineBrightColorPallet, Config.channelTenBrightColorPallet, Config.channelElevenBrightColorPallet, Config.channelTwelveBrightColorPallet];
    Config.drumChannelColorsDim = [Config.channelThirteenDimColorPallet, Config.channelFourteenDimColorPallet, Config.channelFifteenDimColorPallet, Config.channelSixteenDimColorPallet];
    Config.drumChannelColorsBright = [Config.channelThirteenBrightColorPallet, Config.channelFourteenBrightColorPallet, Config.channelFifteenBrightColorPallet, Config.channelSixteenBrightColorPallet];
    Config.drumNoteColorsDim = [Config.channelThirteenDimColorPallet, Config.channelFourteenDimColorPallet, Config.channelFifteenDimColorPallet, Config.channelSixteenDimColorPallet];
    Config.drumNoteColorsBright = [Config.channelThirteenBrightColorPallet, Config.channelFourteenBrightColorPallet, Config.channelFifteenBrightColorPallet, Config.channelSixteenBrightColorPallet];
    Config.midiPitchChannelNames = ["cyan channel", "yellow channel", "orange channel", "green channel", "purple channel", "blue channel"];
    Config.midiDrumChannelNames = ["gray channel", "brown channel", "indigo channel"];
    Config.midiSustainInstruments = [
        0x47,
        0x50,
        0x46,
        0x44,
        0x51,
        0x51,
        0x51,
        0x51,
        0x4A,
    ];
    Config.midiDecayInstruments = [
        0x2E,
        0x2E,
        0x06,
        0x18,
        0x19,
        0x19,
        0x6A,
        0x6A,
        0x21,
    ];
    Config.drumInterval = 6;
    Config.pitchCount = 37;
    Config.maxPitch = 84;
    Config.pitchChannelCountMin = 0;
    Config.pitchChannelCountMax = 12;
    Config.drumChannelCountMin = 0;
    Config.drumChannelCountMax = 4;
    Config.waves = [
        Config._centerWave([1.0 / 15.0, 3.0 / 15.0, 5.0 / 15.0, 7.0 / 15.0, 9.0 / 15.0, 11.0 / 15.0, 13.0 / 15.0, 15.0 / 15.0, 15.0 / 15.0, 13.0 / 15.0, 11.0 / 15.0, 9.0 / 15.0, 7.0 / 15.0, 5.0 / 15.0, 3.0 / 15.0, 1.0 / 15.0, -1.0 / 15.0, -3.0 / 15.0, -5.0 / 15.0, -7.0 / 15.0, -9.0 / 15.0, -11.0 / 15.0, -13.0 / 15.0, -15.0 / 15.0, -15.0 / 15.0, -13.0 / 15.0, -11.0 / 15.0, -9.0 / 15.0, -7.0 / 15.0, -5.0 / 15.0, -3.0 / 15.0, -1.0 / 15.0]),
        Config._centerWave([1.0, -1.0]),
        Config._centerWave([1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([1.0 / 31.0, 3.0 / 31.0, 5.0 / 31.0, 7.0 / 31.0, 9.0 / 31.0, 11.0 / 31.0, 13.0 / 31.0, 15.0 / 31.0, 17.0 / 31.0, 19.0 / 31.0, 21.0 / 31.0, 23.0 / 31.0, 25.0 / 31.0, 27.0 / 31.0, 29.0 / 31.0, 31.0 / 31.0, -31.0 / 31.0, -29.0 / 31.0, -27.0 / 31.0, -25.0 / 31.0, -23.0 / 31.0, -21.0 / 31.0, -19.0 / 31.0, -17.0 / 31.0, -15.0 / 31.0, -13.0 / 31.0, -11.0 / 31.0, -9.0 / 31.0, -7.0 / 31.0, -5.0 / 31.0, -3.0 / 31.0, -1.0 / 31.0]),
        Config._centerWave([0.0, -0.2, -0.4, -0.6, -0.8, -1.0, 1.0, -0.8, -0.6, -0.4, -0.2, 1.0, 0.8, 0.6, 0.4, 0.2]),
        Config._centerWave([1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([1.0, -1.0, 1.0, -1.0, 1.0, 0.0]),
        Config._centerWave([0.0, 0.2, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.95, 0.9, 0.85, 0.8, 0.7, 0.6, 0.5, 0.4, 0.2, 0.0, -0.2, -0.4, -0.5, -0.6, -0.7, -0.8, -0.85, -0.9, -0.95, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -0.95, -0.9, -0.85, -0.8, -0.7, -0.6, -0.5, -0.4, -0.2]),
        Config._centerWave([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0]),
        Config._centerWave([1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([0.0, 0.1875, 0.3125, 0.5625, 0.5, 0.75, 0.875, 1.0, 1.0, 0.6875, 0.5, 0.625, 0.625, 0.5, 0.375, 0.5625, 0.4375, 0.5625, 0.4375, 0.4375, 0.3125, 0.1875, 0.1875, 0.375, 0.5625, 0.5625, 0.5625, 0.5625, 0.5625, 0.4375, 0.25, 0.0]),
        Config._centerWave([1.0, 0.7, 0.1, 0.1, 0, 0, 0, 0, 0, 0.1, 0.2, 0.15, 0.25, 0.125, 0.215, 0.345, 4.0]),
        Config._centerWave([1.0 / 15.0, 3.0 / 15.0, 5.0 / 15.0, 9.0, 0.06]),
        Config._centerWave([-0.5, 3.5, 3.0, -0.5, -0.25, -1.0]),
        Config._centerWave([0.0, 0.05, 0.125, 0.2, 0.25, 0.3, 0.425, 0.475, 0.525, 0.625, 0.675, 0.725, 0.775, 0.8, 0.825, 0.875, 0.9, 0.925, 0.95, 0.975, 0.98, 0.99, 0.995, 1, 0.995, 0.99, 0.98, 0.975, 0.95, 0.925, 0.9, 0.875, 0.825, 0.8, 0.775, 0.725, 0.675, 0.625, 0.525, 0.475, 0.425, 0.3, 0.25, 0.2, 0.125, 0.05, 0.0, -0.05, -0.125, -0.2, -0.25, -0.3, -0.425, -0.475, -0.525, -0.625, -0.675, -0.725, -0.775, -0.8, -0.825, -0.875, -0.9, -0.925, -0.95, -0.975, -0.98, -0.99, -0.995, -1, -0.995, -0.99, -0.98, -0.975, -0.95, -0.925, -0.9, -0.875, -0.825, -0.8, -0.775, -0.725, -0.675, -0.625, -0.525, -0.475, -0.425, -0.3, -0.25, -0.2, -0.125, -0.05]),
        Config._centerWave([1.0, 1.0, 1.0, 1.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0]),
        Config._centerWave([0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]),
        Config._centerWave([1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([1.0, 1.0 / 2.0, 1.0 / 3.0, 1.0 / 4.0]),
        Config._centerWave([-0.9, -1.0, -0.85, -0.775, -0.7, -0.6, -0.5, -0.4, -0.325, -0.225, -0.2, -0.125, -0.1, -0.11, -0.125, -0.15, -0.175, -0.18, -0.2, -0.21, -0.22, -0.21, -0.2, -0.175, -0.15, -0.1, -0.5, 0.75, 0.11, 0.175, 0.2, 0.25, 0.26, 0.275, 0.26, 0.25, 0.225, 0.2, 0.19, 0.18, 0.19, 0.2, 0.21, 0.22, 0.23, 0.24, 0.25, 0.26, 0.275, 0.28, 0.29, 0.3, 0.29, 0.28, 0.27, 0.26, 0.25, 0.225, 0.2, 0.175, 0.15, 0.1, 0.075, 0.0, -0.01, -0.025, 0.025, 0.075, 0.2, 0.3, 0.475, 0.6, 0.75, 0.85, 0.85, 1.0, 0.99, 0.95, 0.8, 0.675, 0.475, 0.275, 0.01, -0.15, -0.3, -0.475, -0.5, -0.6, -0.71, -0.81, -0.9, -1.0, -0.9]),
        Config._centerWave([-1.0, -0.95, -0.975, -0.9, -0.85, -0.8, -0.775, -0.65, -0.6, -0.5, -0.475, -0.35, -0.275, -0.2, -0.125, -0.05, 0.0, 0.075, 0.125, 0.15, 0.20, 0.21, 0.225, 0.25, 0.225, 0.21, 0.20, 0.19, 0.175, 0.125, 0.10, 0.075, 0.06, 0.05, 0.04, 0.025, 0.04, 0.05, 0.10, 0.15, 0.225, 0.325, 0.425, 0.575, 0.70, 0.85, 0.95, 1.0, 0.9, 0.675, 0.375, 0.2, 0.275, 0.4, 0.5, 0.55, 0.6, 0.625, 0.65, 0.65, 0.65, 0.65, 0.64, 0.6, 0.55, 0.5, 0.4, 0.325, 0.25, 0.15, 0.05, -0.05, -0.15, -0.275, -0.35, -0.45, -0.55, -0.65, -0.7, -0.78, -0.825, -0.9, -0.925, -0.95, -0.975]),
        Config._centerWave([1.0, 0.0, 0.1, -0.1, -0.2, -0.4, -0.3, -1.0]),
        Config._centerWave([1.0, -1.0, 4.0, 2.15, 4.13, 5.15, 0.0, -0.05, 1.0]),
        Config._centerWave([6.1, -2.9, 1.4, -2.9]),
        Config._centerWave([1, 4, 2, 1, -0.1, -1, -0.12]),
        Config._centerWave([0.2, 1.0, 2.6, 1.0, 0.0, -2.4]),
        Config._centerWave([1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]),
        Config._centerWave([1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0]),
        Config._centerWave([1.0, -0.9, 0.8, -0.7, 0.6, -0.5, 0.4, -0.3, 0.2, -0.1, 0.0, -0.1, 0.2, -0.3, 0.4, -0.5, 0.6, -0.7, 0.8, -0.9, 1.0]),
    ];
    Config.wavesMixC = [
        Config._centerWave([1.0 / 15.0, 3.0 / 15.0, 5.0 / 15.0, 7.0 / 15.0, 9.0 / 15.0, 11.0 / 15.0, 13.0 / 15.0, 15.0 / 15.0, 15.0 / 15.0, 13.0 / 15.0, 11.0 / 15.0, 9.0 / 15.0, 7.0 / 15.0, 5.0 / 15.0, 3.0 / 15.0, 1.0 / 15.0, -1.0 / 15.0, -3.0 / 15.0, -5.0 / 15.0, -7.0 / 15.0, -9.0 / 15.0, -11.0 / 15.0, -13.0 / 15.0, -15.0 / 15.0, -15.0 / 15.0, -13.0 / 15.0, -11.0 / 15.0, -9.0 / 15.0, -7.0 / 15.0, -5.0 / 15.0, -3.0 / 15.0, -1.0 / 15.0]),
        Config._centerWave([1.0, -1.0]),
        Config._centerWave([1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([1.0 / 31.0, 3.0 / 31.0, 5.0 / 31.0, 7.0 / 31.0, 9.0 / 31.0, 11.0 / 31.0, 13.0 / 31.0, 15.0 / 31.0, 17.0 / 31.0, 19.0 / 31.0, 21.0 / 31.0, 23.0 / 31.0, 25.0 / 31.0, 27.0 / 31.0, 29.0 / 31.0, 31.0 / 31.0, -31.0 / 31.0, -29.0 / 31.0, -27.0 / 31.0, -25.0 / 31.0, -23.0 / 31.0, -21.0 / 31.0, -19.0 / 31.0, -17.0 / 31.0, -15.0 / 31.0, -13.0 / 31.0, -11.0 / 31.0, -9.0 / 31.0, -7.0 / 31.0, -5.0 / 31.0, -3.0 / 31.0, -1.0 / 31.0]),
        Config._centerWave([0.0, -0.2, -0.4, -0.6, -0.8, -1.0, 1.0, -0.8, -0.6, -0.4, -0.2, 1.0, 0.8, 0.6, 0.4, 0.2]),
        Config._centerWave([1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([1.0, -1.0, 1.0, -1.0, 1.0, 0.0]),
        Config._centerWave([0.0, 0.2, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.95, 0.9, 0.85, 0.8, 0.7, 0.6, 0.5, 0.4, 0.2, 0.0, -0.2, -0.4, -0.5, -0.6, -0.7, -0.8, -0.85, -0.9, -0.95, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -0.95, -0.9, -0.85, -0.8, -0.7, -0.6, -0.5, -0.4, -0.2]),
        Config._centerWave([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0]),
        Config._centerWave([1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([0.0, 0.1875, 0.3125, 0.5625, 0.5, 0.75, 0.875, 1.0, 1.0, 0.6875, 0.5, 0.625, 0.625, 0.5, 0.375, 0.5625, 0.4375, 0.5625, 0.4375, 0.4375, 0.3125, 0.1875, 0.1875, 0.375, 0.5625, 0.5625, 0.5625, 0.5625, 0.5625, 0.4375, 0.25, 0.0]),
        Config._centerWave([1.0, 0.7, 0.1, 0.1, 0, 0, 0, 0, 0, 0.1, 0.2, 0.15, 0.25, 0.125, 0.215, 0.345, 4.0]),
        Config._centerWave([1.0 / 15.0, 3.0 / 15.0, 5.0 / 15.0, 9.0, 0.06]),
        Config._centerWave([-0.5, 3.5, 3.0, -0.5, -0.25, -1.0]),
        Config._centerWave([0.0, 0.05, 0.125, 0.2, 0.25, 0.3, 0.425, 0.475, 0.525, 0.625, 0.675, 0.725, 0.775, 0.8, 0.825, 0.875, 0.9, 0.925, 0.95, 0.975, 0.98, 0.99, 0.995, 1, 0.995, 0.99, 0.98, 0.975, 0.95, 0.925, 0.9, 0.875, 0.825, 0.8, 0.775, 0.725, 0.675, 0.625, 0.525, 0.475, 0.425, 0.3, 0.25, 0.2, 0.125, 0.05, 0.0, -0.05, -0.125, -0.2, -0.25, -0.3, -0.425, -0.475, -0.525, -0.625, -0.675, -0.725, -0.775, -0.8, -0.825, -0.875, -0.9, -0.925, -0.95, -0.975, -0.98, -0.99, -0.995, -1, -0.995, -0.99, -0.98, -0.975, -0.95, -0.925, -0.9, -0.875, -0.825, -0.8, -0.775, -0.725, -0.675, -0.625, -0.525, -0.475, -0.425, -0.3, -0.25, -0.2, -0.125, -0.05]),
        Config._centerWave([1.0, 1.0, 1.0, 1.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0]),
        Config._centerWave([0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]),
        Config._centerWave([1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([1.0, 1.0 / 2.0, 1.0 / 3.0, 1.0 / 4.0]),
        Config._centerWave([-0.9, -1.0, -0.85, -0.775, -0.7, -0.6, -0.5, -0.4, -0.325, -0.225, -0.2, -0.125, -0.1, -0.11, -0.125, -0.15, -0.175, -0.18, -0.2, -0.21, -0.22, -0.21, -0.2, -0.175, -0.15, -0.1, -0.5, 0.75, 0.11, 0.175, 0.2, 0.25, 0.26, 0.275, 0.26, 0.25, 0.225, 0.2, 0.19, 0.18, 0.19, 0.2, 0.21, 0.22, 0.23, 0.24, 0.25, 0.26, 0.275, 0.28, 0.29, 0.3, 0.29, 0.28, 0.27, 0.26, 0.25, 0.225, 0.2, 0.175, 0.15, 0.1, 0.075, 0.0, -0.01, -0.025, 0.025, 0.075, 0.2, 0.3, 0.475, 0.6, 0.75, 0.85, 0.85, 1.0, 0.99, 0.95, 0.8, 0.675, 0.475, 0.275, 0.01, -0.15, -0.3, -0.475, -0.5, -0.6, -0.71, -0.81, -0.9, -1.0, -0.9]),
        Config._centerWave([-1.0, -0.95, -0.975, -0.9, -0.85, -0.8, -0.775, -0.65, -0.6, -0.5, -0.475, -0.35, -0.275, -0.2, -0.125, -0.05, 0.0, 0.075, 0.125, 0.15, 0.20, 0.21, 0.225, 0.25, 0.225, 0.21, 0.20, 0.19, 0.175, 0.125, 0.10, 0.075, 0.06, 0.05, 0.04, 0.025, 0.04, 0.05, 0.10, 0.15, 0.225, 0.325, 0.425, 0.575, 0.70, 0.85, 0.95, 1.0, 0.9, 0.675, 0.375, 0.2, 0.275, 0.4, 0.5, 0.55, 0.6, 0.625, 0.65, 0.65, 0.65, 0.65, 0.64, 0.6, 0.55, 0.5, 0.4, 0.325, 0.25, 0.15, 0.05, -0.05, -0.15, -0.275, -0.35, -0.45, -0.55, -0.65, -0.7, -0.78, -0.825, -0.9, -0.925, -0.95, -0.975]),
        Config._centerWave([0.7, 0.0, 0.1, -0.1, -0.2, -0.4, -0.3, -0.7]),
        Config._centerWave([1.0, -1.0, 4.0, 2.15, 4.1, 5.05, 0.0, -0.05, 1.0]),
        Config._centerWave([4.5, -1.7, 1.0, -1.7]),
        Config._centerWave([0.1, 0.4, 0.2, 0.1, -0.1, -1, -0.12]),
        Config._centerWave([.03, .13, .30, 1.0, 0.0, -.26]),
        Config._centerWave([2, 1.75, 1.5, 1.25, 1, .75, .5, .25, 0.0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75]),
        Config._centerWave([1.0, 1.9, 1.8, 1.7, 1.6, 1.5, 1.4, 1.3, 1.2, 1.1, 1.0]),
        Config._centerWave([-1.0, -0.9, 0.8, -0.7, 0.6, -0.5, 0.4, -0.3, 0.2, -0.1, 0.0, -0.1, 0.2, -0.3, 0.4, -0.5, 0.6, -0.7, 0.8, -0.9, -1.0]),
    ];
    Config.pwmwaves = [
        Config._centerWave([1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
    ];
    Config.sineWaveLength = 1 << 8;
    Config.sineWaveMask = Config.sineWaveLength - 1;
    Config.sineWave = Config.generateSineWave();
    function toNameMap(array) {
        const dictionary = {};
        for (let i = 0; i < array.length; i++) {
            const value = array[i];
            value.index = i;
            dictionary[value.name] = value;
        }
        const result = array;
        result.dictionary = dictionary;
        return result;
    }

    var __values$1 = (exports && exports.__values) || function(o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m) return m.call(o);
        if (o && typeof o.length === "number") return {
            next: function () {
                if (o && i >= o.length) o = void 0;
                return { value: o && o[i++], done: !o };
            }
        };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    };
    var __read = (exports && exports.__read) || function (o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    };
    var __spread = (exports && exports.__spread) || function () {
        for (var ar = [], i = 0; i < arguments.length; i++) ar = ar.concat(__read(arguments[i]));
        return ar;
    };
    function applyElementArgs(element, args) {
        var e_1, _a, e_2, _b, e_3, _c;
        try {
            for (var args_1 = __values$1(args), args_1_1 = args_1.next(); !args_1_1.done; args_1_1 = args_1.next()) {
                var arg = args_1_1.value;
                if (arg instanceof Node) {
                    element.appendChild(arg);
                }
                else if (typeof arg === "string") {
                    element.appendChild(document.createTextNode(arg));
                }
                else if (typeof arg === "function") {
                    applyElementArgs(element, [arg()]);
                }
                else if (Array.isArray(arg)) {
                    applyElementArgs(element, arg);
                }
                else if (arg && typeof Symbol !== "undefined" && typeof arg[Symbol.iterator] === "function") {
                    applyElementArgs(element, __spread(arg));
                }
                else if (arg && arg.constructor === Object && element instanceof Element) {
                    try {
                        for (var _d = (e_2 = void 0, __values$1(Object.keys(arg))), _e = _d.next(); !_e.done; _e = _d.next()) {
                            var key = _e.value;
                            var value = arg[key];
                            if (key === "class") {
                                if (typeof value === "string") {
                                    element.setAttribute("class", value);
                                }
                                else if (Array.isArray(arg) || (value && typeof Symbol !== "undefined" && typeof value[Symbol.iterator] === "function")) {
                                    element.setAttribute("class", __spread(value).join(" "));
                                }
                                else {
                                    console.warn("Invalid " + key + " value \"" + value + "\" on " + element.tagName + " element.");
                                }
                            }
                            else if (key === "style") {
                                if (value && value.constructor === Object) {
                                    try {
                                        for (var _f = (e_3 = void 0, __values$1(Object.keys(value))), _g = _f.next(); !_g.done; _g = _f.next()) {
                                            var styleKey = _g.value;
                                            if (styleKey in element.style) {
                                                element.style[styleKey] = value[styleKey];
                                            }
                                            else {
                                                element.style.setProperty(styleKey, value[styleKey]);
                                            }
                                        }
                                    }
                                    catch (e_3_1) { e_3 = { error: e_3_1 }; }
                                    finally {
                                        try {
                                            if (_g && !_g.done && (_c = _f.return)) _c.call(_f);
                                        }
                                        finally { if (e_3) throw e_3.error; }
                                    }
                                }
                                else {
                                    element.setAttribute(key, value);
                                }
                            }
                            else if (typeof (value) === "function") {
                                element[key] = value;
                            }
                            else if (typeof (value) === "boolean") {
                                if (value)
                                    element.setAttribute(key, "");
                                else
                                    element.removeAttribute(key);
                            }
                            else {
                                element.setAttribute(key, value);
                            }
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (_e && !_e.done && (_b = _d.return)) _b.call(_d);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                }
                else {
                    element.appendChild(document.createTextNode(arg));
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (args_1_1 && !args_1_1.done && (_a = args_1.return)) _a.call(args_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return element;
    }
    var svgNS = "http://www.w3.org/2000/svg";
    function parseHTML() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return document.createRange().createContextualFragment(args.join());
    }
    function parseSVG() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var fragment = document.createDocumentFragment();
        var svgParser = new DOMParser().parseFromString("<svg xmlns=\"http://www.w3.org/2000/svg\">" + args.join() + "</svg>", "image/svg+xml").documentElement;
        while (svgParser.firstChild !== null) {
            document.importNode(svgParser.firstChild, true);
            fragment.appendChild(svgParser.firstChild);
        }
        return fragment;
    }

    var __values = (exports && exports.__values) || function(o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m) return m.call(o);
        if (o && typeof o.length === "number") return {
            next: function () {
                if (o && i >= o.length) o = void 0;
                return { value: o && o[i++], done: !o };
            }
        };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    };
    var e_1, _a, e_2, _b;
    var HTML = parseHTML;
    var SVG = parseSVG;
    var _loop_1 = function (name_1) {
        HTML[name_1] = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            return applyElementArgs(document.createElement(name_1), args);
        };
    };
    try {
        for (var _c = __values("a abbr address area article aside audio b base bdi bdo blockquote br button canvas caption cite code col colgroup datalist dd del details dfn dialog div dl dt em embed fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr i iframe img input ins kbd label legend li link main map mark menu menuitem meta meter nav noscript object ol optgroup option output p param picture pre progress q rp rt ruby s samp script section select small source span strong style sub summary sup table tbody td template textarea tfoot th thead time title tr track u ul var video wbr".split(" ")), _d = _c.next(); !_d.done; _d = _c.next()) {
            var name_1 = _d.value;
            _loop_1(name_1);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
        }
        finally { if (e_1) throw e_1.error; }
    }
    var _loop_2 = function (name_2) {
        SVG[name_2] = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            return applyElementArgs(document.createElementNS(svgNS, name_2), args);
        };
        if (/-/.test(name_2)) {
            var snakeCaseName = name_2.replace(/-/g, "_");
            SVG[snakeCaseName] = function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                return applyElementArgs(document.createElementNS(svgNS, name_2), args);
            };
        }
    };
    try {
        for (var _e = __values("a altGlyph altGlyphDef altGlyphItem animate animateMotion animateTransform circle clipPath color-profile cursor defs desc discard ellipse feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting feDisplacementMap feDistantLight feDropShadow feFlood feFuncA feFuncB feFuncG feFuncR feGaussianBlur feImage feMerge feMergeNode feMorphology feOffset fePointLight feSpecularLighting feSpotLight feTile feTurbulence filter font font-face font-face-format font-face-name font-face-src font-face-uri foreignObject g glyph glyphRef hkern image line linearGradient marker mask metadata missing-glyph mpath path pattern polygon polyline radialGradient rect script set stop style svg switch symbol text textPath title tref tspan use view vkern".split(" ")), _f = _e.next(); !_f.done; _f = _e.next()) {
            var name_2 = _f.value;
            _loop_2(name_2);
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
        }
        finally { if (e_2) throw e_2.error; }
    }

    function clamp(min, max, val) {
        max = max - 1;
        if (val <= max) {
            if (val >= min)
                return val;
            else
                return min;
        }
        else {
            return max;
        }
    }

    class BitFieldReader {
        constructor(base64CharCodeToInt, source, startIndex, stopIndex) {
            this._bits = [];
            this._readIndex = 0;
            for (let i = startIndex; i < stopIndex; i++) {
                const value = base64CharCodeToInt[source.charCodeAt(i)];
                this._bits.push((value >> 5) & 0x1);
                this._bits.push((value >> 4) & 0x1);
                this._bits.push((value >> 3) & 0x1);
                this._bits.push((value >> 2) & 0x1);
                this._bits.push((value >> 1) & 0x1);
                this._bits.push(value & 0x1);
            }
        }
        read(bitCount) {
            let result = 0;
            while (bitCount > 0) {
                result = result << 1;
                result += this._bits[this._readIndex++];
                bitCount--;
            }
            return result;
        }
        readLongTail(minValue, minBits) {
            let result = minValue;
            let numBits = minBits;
            while (this._bits[this._readIndex++]) {
                result += 1 << numBits;
                numBits++;
            }
            while (numBits > 0) {
                numBits--;
                if (this._bits[this._readIndex++]) {
                    result += 1 << numBits;
                }
            }
            return result;
        }
        readPartDuration() {
            return this.readLongTail(1, 2);
        }
        readPinCount() {
            return this.readLongTail(1, 0);
        }
        readPitchInterval() {
            if (this.read(1)) {
                return -this.readLongTail(1, 3);
            }
            else {
                return this.readLongTail(1, 3);
            }
        }
    }
    class BitFieldWriter {
        constructor() {
            this._bits = [];
        }
        write(bitCount, value) {
            bitCount--;
            while (bitCount >= 0) {
                this._bits.push((value >>> bitCount) & 1);
                bitCount--;
            }
        }
        writeLongTail(minValue, minBits, value) {
            if (value < minValue)
                throw new Error("value out of bounds");
            value -= minValue;
            let numBits = minBits;
            while (value >= (1 << numBits)) {
                this._bits.push(1);
                value -= 1 << numBits;
                numBits++;
            }
            this._bits.push(0);
            while (numBits > 0) {
                numBits--;
                this._bits.push((value >>> numBits) & 1);
            }
        }
        writePartDuration(value) {
            this.writeLongTail(1, 2, value);
        }
        writePinCount(value) {
            this.writeLongTail(1, 0, value);
        }
        writePitchInterval(value) {
            if (value < 0) {
                this.write(1, 1);
                this.writeLongTail(1, 3, -value);
            }
            else {
                this.write(1, 0);
                this.writeLongTail(1, 3, value);
            }
        }
        concat(other) {
            this._bits = this._bits.concat(other._bits);
        }
        encodeBase64(base64IntToCharCode, buffer) {
            for (let i = 0; i < this._bits.length; i += 6) {
                const value = (this._bits[i] << 5) | (this._bits[i + 1] << 4) | (this._bits[i + 2] << 3) | (this._bits[i + 3] << 2) | (this._bits[i + 4] << 1) | this._bits[i + 5];
                buffer.push(base64IntToCharCode[value]);
            }
            return buffer;
        }
        lengthBase64() {
            return Math.ceil(this._bits.length / 6);
        }
    }
    class Operator {
        constructor(index) {
            this.frequency = 0;
            this.amplitude = 0;
            this.envelope = 0;
            this.reset(index);
        }
        reset(index) {
            this.frequency = 0;
            this.amplitude = (index <= 1) ? Config.operatorAmplitudeMax : 0;
            this.envelope = 1;
        }
        copy(other) {
            this.frequency = other.frequency;
            this.amplitude = other.amplitude;
            this.envelope = other.envelope;
        }
    }
    function makeNotePin(interval, time, volume) {
        return { interval: interval, time: time, volume: volume };
    }
    function makeNote(pitch, start, end, volume, fadeout = false) {
        return {
            pitches: [pitch],
            pins: [makeNotePin(0, 0, volume), makeNotePin(0, end - start, fadeout ? 0 : volume)],
            start: start,
            end: end,
        };
    }
    class Instrument {
        constructor() {
            this.type = 0;
            this.wave = 1;
            this.filter = 1;
            this.transition = 1;
            this.effect = 0;
            this.harm = 0;
            this.fmChorus = 1;
            this.imute = 0;
            this.octoff = 0;
            this.chorus = 0;
            this.volume = 0;
            this.ipan = 4;
            this.algorithm = 0;
            this.feedbackType = 0;
            this.feedbackAmplitude = 0;
            this.feedbackEnvelope = 1;
            this.operators = [];
            for (let i = 0; i < Config.operatorCount; i++) {
                this.operators.push(new Operator(i));
            }
        }
        reset() {
            this.type = 0;
            this.wave = 1;
            this.filter = 1;
            this.transition = 1;
            this.effect = 0;
            this.harm = 0;
            this.fmChorus = 1;
            this.imute = 0;
            this.ipan = 4;
            this.octoff = 0;
            this.chorus = 0;
            this.volume = 0;
            this.algorithm = 0;
            this.feedbackType = 0;
            this.feedbackAmplitude = 0;
            this.feedbackEnvelope = 1;
            for (let i = 0; i < this.operators.length; i++) {
                this.operators[i].reset(i);
            }
        }
        setTypeAndReset(type) {
            this.type = type;
            switch (type) {
                case 0:
                    this.wave = 1;
                    this.filter = 1;
                    this.transition = 1;
                    this.effect = 0;
                    this.harm = 0;
                    this.imute = 0;
                    this.ipan = 4;
                    this.octoff = 0;
                    this.chorus = 0;
                    this.volume = 0;
                    break;
                case 1:
                    this.wave = 1;
                    this.transition = 1;
                    this.volume = 0;
                    this.imute = 0;
                    this.ipan = 4;
                    this.harm = 0;
                    this.octoff = 0;
                    break;
                case 2:
                    this.transition = 1;
                    this.octoff = 0;
                    this.fmChorus = 1;
                    this.ipan = 4;
                    this.effect = 0;
                    this.algorithm = 0;
                    this.feedbackType = 0;
                    this.feedbackAmplitude = 0;
                    this.feedbackEnvelope = 1;
                    this.volume = 0;
                    for (let i = 0; i < this.operators.length; i++) {
                        this.operators[i].reset(i);
                    }
                    break;
                case 3:
                    this.wave = 1;
                    this.filter = 1;
                    this.transition = 1;
                    this.effect = 0;
                    this.harm = 0;
                    this.imute = 0;
                    this.ipan = 4;
                    this.octoff = 0;
                    this.chorus = 0;
                    this.volume = 0;
                    break;
            }
        }
        copy(other) {
            this.type = other.type;
            this.wave = other.wave;
            this.filter = other.filter;
            this.transition = other.transition;
            this.effect = other.effect;
            this.chorus = other.chorus;
            this.volume = other.volume;
            this.harm = other.harm;
            this.fmChorus = other.fmChorus;
            this.imute = other.imute;
            this.ipan = other.ipan;
            this.octoff = other.octoff;
            this.algorithm = other.algorithm;
            this.feedbackType = other.feedbackType;
            this.feedbackAmplitude = other.feedbackAmplitude;
            this.feedbackEnvelope = other.feedbackEnvelope;
            for (let i = 0; i < this.operators.length; i++) {
                this.operators[i].copy(other.operators[i]);
            }
        }
    }
    class Channel {
        constructor() {
            this.octave = 0;
            this.instruments = [];
            this.patterns = [];
            this.bars = [];
        }
    }
    class Pattern {
        constructor() {
            this.notes = [];
            this.instrument = 0;
        }
        cloneNotes() {
            const result = [];
            for (const oldNote of this.notes) {
                const newNote = makeNote(-1, oldNote.start, oldNote.end, 3);
                newNote.pitches = oldNote.pitches.concat();
                newNote.pins = [];
                for (const oldPin of oldNote.pins) {
                    newNote.pins.push(makeNotePin(oldPin.interval, oldPin.time, oldPin.volume));
                }
                result.push(newNote);
            }
            return result;
        }
        reset() {
            this.notes.length = 0;
            this.instrument = 0;
        }
    }
    class Song {
        constructor(string) {
            this.channels = [];
            this._fingerprint = [];
            if (string != undefined) {
                this.fromBase64String(string);
            }
            else {
                this.initToDefault(true);
            }
        }
        getChannelCount() {
            return this.pitchChannelCount + this.drumChannelCount;
        }
        getChannelUnusedCount() {
            return (Config.pitchChannelCountMax + Config.drumChannelCountMax) - (this.pitchChannelCount + this.drumChannelCount);
        }
        getTimeSig() {
            return this.beatsPerBar + "/" + this.partsPerBeat + " with " + this.barCount + " bars.";
        }
        getScaleNKey() {
            return ' "' + Config.scales[this.scale].name + '" and your key is ' + Config.keys[this.key].name;
        }
        getChannelIsDrum(channel) {
            return (channel >= this.pitchChannelCount);
        }
        getChannelColorDim(channel) {
            return channel < this.pitchChannelCount ? Config.pitchChannelColorsDim[channel] : Config.drumChannelColorsDim[channel - this.pitchChannelCount];
        }
        getChannelColorBright(channel) {
            return channel < this.pitchChannelCount ? Config.pitchChannelColorsBright[channel] : Config.drumChannelColorsBright[channel - this.pitchChannelCount];
        }
        getNoteColorDim(channel) {
            return channel < this.pitchChannelCount ? Config.pitchNoteColorsDim[channel] : Config.drumNoteColorsDim[channel - this.pitchChannelCount];
        }
        getNoteColorBright(channel) {
            return channel < this.pitchChannelCount ? Config.pitchNoteColorsBright[channel] : Config.drumNoteColorsBright[channel - this.pitchChannelCount];
        }
        initToDefault(andResetChannels = true) {
            this.scale = 0;
            this.setSongTheme = "none";
            this.key = Config.keys.map(key => key.name).indexOf("C");
            this.mix = 1;
            this.sampleRate = 2;
            this.loopStart = 0;
            this.loopLength = 4;
            this.tempo = 7;
            this.reverb = 0;
            this.blend = 0;
            this.riff = 0;
            this.detune = 0;
            this.muff = 0;
            this.beatsPerBar = 8;
            this.barCount = 16;
            this.patternsPerChannel = 8;
            this.partsPerBeat = 4;
            this.instrumentsPerChannel = 1;
            if (andResetChannels) {
                this.pitchChannelCount = 4;
                this.drumChannelCount = 1;
                for (let channelIndex = 0; channelIndex < this.getChannelCount(); channelIndex++) {
                    if (this.channels.length <= channelIndex) {
                        this.channels[channelIndex] = new Channel();
                    }
                    const channel = this.channels[channelIndex];
                    channel.octave = 4 - channelIndex;
                    for (let pattern = 0; pattern < this.patternsPerChannel; pattern++) {
                        if (channel.patterns.length <= pattern) {
                            channel.patterns[pattern] = new Pattern();
                        }
                        else {
                            channel.patterns[pattern].reset();
                        }
                    }
                    channel.patterns.length = this.patternsPerChannel;
                    for (let instrument = 0; instrument < this.instrumentsPerChannel; instrument++) {
                        if (channel.instruments.length <= instrument) {
                            channel.instruments[instrument] = new Instrument();
                        }
                        else {
                            channel.instruments[instrument].reset();
                        }
                    }
                    channel.instruments.length = this.instrumentsPerChannel;
                    for (let bar = 0; bar < this.barCount; bar++) {
                        channel.bars[bar] = bar < 4 ? 1 : 0;
                    }
                    channel.bars.length = this.barCount;
                }
                this.channels.length = this.getChannelCount();
            }
        }
        toBase64String() {
            let bits;
            let buffer = [];
            const base64IntToCharCode = Song._base64IntToCharCode;
            buffer.push(Song._variant);
            buffer.push(base64IntToCharCode[Song._latestNepBoxVersion]);
            buffer.push(110, base64IntToCharCode[this.pitchChannelCount], base64IntToCharCode[this.drumChannelCount]);
            buffer.push(122);
            var encodedSongTheme = encodeURIComponent(this.setSongTheme);
            buffer.push(base64IntToCharCode[encodedSongTheme.length >> 6], base64IntToCharCode[encodedSongTheme.length & 0x3f]);
            for (let i = 0; i < encodedSongTheme.length; i++) {
                buffer.push(encodedSongTheme.charCodeAt(i));
            }
            buffer.push(115, base64IntToCharCode[this.scale]);
            buffer.push(117, base64IntToCharCode[this.mix]);
            buffer.push(124, base64IntToCharCode[this.sampleRate]);
            buffer.push(107, base64IntToCharCode[this.key]);
            buffer.push(108, base64IntToCharCode[this.loopStart >> 6], base64IntToCharCode[this.loopStart & 0x3f]);
            buffer.push(101, base64IntToCharCode[(this.loopLength - 1) >> 6], base64IntToCharCode[(this.loopLength - 1) & 0x3f]);
            buffer.push(116, base64IntToCharCode[this.tempo]);
            buffer.push(109, base64IntToCharCode[this.reverb]);
            buffer.push(120, base64IntToCharCode[this.blend]);
            buffer.push(121, base64IntToCharCode[this.riff]);
            buffer.push(72, base64IntToCharCode[this.detune]);
            buffer.push(36, base64IntToCharCode[this.muff]);
            buffer.push(97, base64IntToCharCode[this.beatsPerBar - 1]);
            buffer.push(103, base64IntToCharCode[(this.barCount - 1) >> 6], base64IntToCharCode[(this.barCount - 1) & 0x3f]);
            buffer.push(106, base64IntToCharCode[this.patternsPerChannel - 1]);
            buffer.push(105, base64IntToCharCode[this.instrumentsPerChannel - 1]);
            buffer.push(114, base64IntToCharCode[Config.partCounts.indexOf(this.partsPerBeat)]);
            buffer.push(111);
            for (let channel = 0; channel < this.getChannelCount(); channel++) {
                buffer.push(base64IntToCharCode[this.channels[channel].octave]);
            }
            for (let channel = 0; channel < this.getChannelCount(); channel++) {
                for (let i = 0; i < this.instrumentsPerChannel; i++) {
                    const instrument = this.channels[channel].instruments[i];
                    if (channel < this.pitchChannelCount) {
                        buffer.push(84, base64IntToCharCode[instrument.type]);
                        if (instrument.type == 0) {
                            buffer.push(119, base64IntToCharCode[instrument.wave]);
                            buffer.push(102, base64IntToCharCode[instrument.filter]);
                            buffer.push(100, base64IntToCharCode[instrument.transition]);
                            buffer.push(99, base64IntToCharCode[instrument.effect]);
                            buffer.push(113, base64IntToCharCode[instrument.harm]);
                            buffer.push(71, base64IntToCharCode[instrument.imute]);
                            buffer.push(76, base64IntToCharCode[instrument.ipan]);
                            buffer.push(66, base64IntToCharCode[instrument.octoff]);
                            buffer.push(104, base64IntToCharCode[instrument.chorus]);
                            buffer.push(118, base64IntToCharCode[instrument.volume]);
                        }
                        else if (instrument.type == 1) {
                            buffer.push(100, base64IntToCharCode[instrument.transition]);
                            buffer.push(99, base64IntToCharCode[instrument.effect]);
                            buffer.push(66, base64IntToCharCode[instrument.octoff]);
                            buffer.push(35, base64IntToCharCode[instrument.fmChorus]);
                            buffer.push(71, base64IntToCharCode[instrument.imute]);
                            buffer.push(76, base64IntToCharCode[instrument.ipan]);
                            buffer.push(65, base64IntToCharCode[instrument.algorithm]);
                            buffer.push(70, base64IntToCharCode[instrument.feedbackType]);
                            buffer.push(95, base64IntToCharCode[instrument.feedbackAmplitude]);
                            buffer.push(86, base64IntToCharCode[instrument.feedbackEnvelope]);
                            buffer.push(118, base64IntToCharCode[instrument.volume]);
                            buffer.push(81);
                            for (let o = 0; o < Config.operatorCount; o++) {
                                buffer.push(base64IntToCharCode[instrument.operators[o].frequency]);
                            }
                            buffer.push(80);
                            for (let o = 0; o < Config.operatorCount; o++) {
                                buffer.push(base64IntToCharCode[instrument.operators[o].amplitude]);
                            }
                            buffer.push(69);
                            for (let o = 0; o < Config.operatorCount; o++) {
                                buffer.push(base64IntToCharCode[instrument.operators[o].envelope]);
                            }
                        }
                        else if (instrument.type == 3) {
                            buffer.push(119, base64IntToCharCode[instrument.wave]);
                            buffer.push(102, base64IntToCharCode[instrument.filter]);
                            buffer.push(100, base64IntToCharCode[instrument.transition]);
                            buffer.push(99, base64IntToCharCode[instrument.effect]);
                            buffer.push(113, base64IntToCharCode[instrument.harm]);
                            buffer.push(71, base64IntToCharCode[instrument.imute]);
                            buffer.push(76, base64IntToCharCode[instrument.ipan]);
                            buffer.push(66, base64IntToCharCode[instrument.octoff]);
                            buffer.push(104, base64IntToCharCode[instrument.chorus]);
                            buffer.push(118, base64IntToCharCode[instrument.volume]);
                        }
                        else {
                            throw new Error("Unknown instrument type.");
                        }
                    }
                    else {
                        buffer.push(84, base64IntToCharCode[2]);
                        buffer.push(119, base64IntToCharCode[instrument.wave]);
                        buffer.push(100, base64IntToCharCode[instrument.transition]);
                        buffer.push(118, base64IntToCharCode[instrument.volume]);
                        buffer.push(71, base64IntToCharCode[instrument.imute]);
                        buffer.push(113, base64IntToCharCode[instrument.harm]);
                        buffer.push(66, base64IntToCharCode[instrument.octoff]);
                        buffer.push(76, base64IntToCharCode[instrument.ipan]);
                    }
                }
            }
            buffer.push(98);
            bits = new BitFieldWriter();
            let neededBits = 0;
            while ((1 << neededBits) < this.patternsPerChannel + 1)
                neededBits++;
            for (let channel = 0; channel < this.getChannelCount(); channel++)
                for (let i = 0; i < this.barCount; i++) {
                    bits.write(neededBits, this.channels[channel].bars[i]);
                }
            bits.encodeBase64(base64IntToCharCode, buffer);
            buffer.push(112);
            bits = new BitFieldWriter();
            let neededInstrumentBits = 0;
            while ((1 << neededInstrumentBits) < this.instrumentsPerChannel)
                neededInstrumentBits++;
            for (let channel = 0; channel < this.getChannelCount(); channel++) {
                const isDrum = this.getChannelIsDrum(channel);
                const octaveOffset = isDrum ? 0 : this.channels[channel].octave * 12;
                let lastPitch = (isDrum ? 4 : 12) + octaveOffset;
                const recentPitches = isDrum ? [4, 6, 7, 2, 3, 8, 0, 10] : [12, 19, 24, 31, 36, 7, 0];
                const recentShapes = [];
                for (let i = 0; i < recentPitches.length; i++) {
                    recentPitches[i] += octaveOffset;
                }
                for (const p of this.channels[channel].patterns) {
                    bits.write(neededInstrumentBits, p.instrument);
                    if (p.notes.length > 0) {
                        bits.write(1, 1);
                        let curPart = 0;
                        for (const t of p.notes) {
                            if (t.start > curPart) {
                                bits.write(2, 0);
                                bits.writePartDuration(t.start - curPart);
                            }
                            const shapeBits = new BitFieldWriter();
                            for (let i = 1; i < t.pitches.length; i++)
                                shapeBits.write(1, 1);
                            if (t.pitches.length < 4)
                                shapeBits.write(1, 0);
                            shapeBits.writePinCount(t.pins.length - 1);
                            shapeBits.write(2, t.pins[0].volume);
                            let shapePart = 0;
                            let startPitch = t.pitches[0];
                            let currentPitch = startPitch;
                            const pitchBends = [];
                            for (let i = 1; i < t.pins.length; i++) {
                                const pin = t.pins[i];
                                const nextPitch = startPitch + pin.interval;
                                if (currentPitch != nextPitch) {
                                    shapeBits.write(1, 1);
                                    pitchBends.push(nextPitch);
                                    currentPitch = nextPitch;
                                }
                                else {
                                    shapeBits.write(1, 0);
                                }
                                shapeBits.writePartDuration(pin.time - shapePart);
                                shapePart = pin.time;
                                shapeBits.write(2, pin.volume);
                            }
                            const shapeString = String.fromCharCode.apply(null, shapeBits.encodeBase64(base64IntToCharCode, []));
                            const shapeIndex = recentShapes.indexOf(shapeString);
                            if (shapeIndex == -1) {
                                bits.write(2, 1);
                                bits.concat(shapeBits);
                            }
                            else {
                                bits.write(1, 1);
                                bits.writeLongTail(0, 0, shapeIndex);
                                recentShapes.splice(shapeIndex, 1);
                            }
                            recentShapes.unshift(shapeString);
                            if (recentShapes.length > 10)
                                recentShapes.pop();
                            const allPitches = t.pitches.concat(pitchBends);
                            for (let i = 0; i < allPitches.length; i++) {
                                const pitch = allPitches[i];
                                const pitchIndex = recentPitches.indexOf(pitch);
                                if (pitchIndex == -1) {
                                    let interval = 0;
                                    let pitchIter = lastPitch;
                                    if (pitchIter < pitch) {
                                        while (pitchIter != pitch) {
                                            pitchIter++;
                                            if (recentPitches.indexOf(pitchIter) == -1)
                                                interval++;
                                        }
                                    }
                                    else {
                                        while (pitchIter != pitch) {
                                            pitchIter--;
                                            if (recentPitches.indexOf(pitchIter) == -1)
                                                interval--;
                                        }
                                    }
                                    bits.write(1, 0);
                                    bits.writePitchInterval(interval);
                                }
                                else {
                                    bits.write(1, 1);
                                    bits.write(3, pitchIndex);
                                    recentPitches.splice(pitchIndex, 1);
                                }
                                recentPitches.unshift(pitch);
                                if (recentPitches.length > 8)
                                    recentPitches.pop();
                                if (i == t.pitches.length - 1) {
                                    lastPitch = t.pitches[0];
                                }
                                else {
                                    lastPitch = pitch;
                                }
                            }
                            curPart = t.end;
                        }
                        if (curPart < this.beatsPerBar * this.partsPerBeat) {
                            bits.write(2, 0);
                            bits.writePartDuration(this.beatsPerBar * this.partsPerBeat - curPart);
                        }
                    }
                    else {
                        bits.write(1, 0);
                    }
                }
            }
            let stringLength = bits.lengthBase64();
            let digits = [];
            while (stringLength > 0) {
                digits.unshift(base64IntToCharCode[stringLength & 0x3f]);
                stringLength = stringLength >> 6;
            }
            buffer.push(base64IntToCharCode[digits.length]);
            Array.prototype.push.apply(buffer, digits);
            bits.encodeBase64(base64IntToCharCode, buffer);
            if (buffer.length >= 65535)
                throw new Error("Song hash code too long.");
            return String.fromCharCode.apply(null, buffer);
        }
        fromBase64String(compressed) {
            if (compressed == null || compressed == "") {
                this.initToDefault(true);
                return;
            }
            let charIndex = 0;
            while (compressed.charCodeAt(charIndex) <= 32)
                charIndex++;
            if (compressed.charCodeAt(charIndex) == 35)
                charIndex++;
            if (compressed.charCodeAt(charIndex) == 123) {
                this.fromJsonObject(JSON.parse(charIndex == 0 ? compressed : compressed.substring(charIndex)));
                return;
            }
            const variantTest = compressed.charCodeAt(charIndex);
            let fromOld;
            let fromNepBox;
            if (variantTest == 0x6E) {
                fromOld = false;
                fromNepBox = true;
                charIndex++;
            }
            else {
                fromOld = true;
                fromNepBox = false;
            }
            const version = Song._base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
            if (fromOld && (version == -1 || version > Song._latestBeepboxVersion || version < Song._oldestBeepboxVersion))
                return;
            if (fromNepBox && (version == -1 || version > Song._latestNepBoxVersion || version < Song._oldestNepBoxVersion))
                return;
            const beforeThree = version < 3;
            const beforeFour = version < 4;
            const beforeFive = version < 5;
            const beforeSix = version < 6;
            const base64CharCodeToInt = Song._base64CharCodeToInt;
            this.initToDefault((fromOld && beforeSix) || (fromNepBox));
            if (fromOld && beforeThree) {
                for (const channel of this.channels)
                    channel.instruments[0].transition = 0;
                this.channels[3].instruments[0].wave = 0;
            }
            let instrumentChannelIterator = 0;
            let instrumentIndexIterator = -1;
            while (charIndex < compressed.length) {
                const command = compressed.charCodeAt(charIndex++);
                let channel;
                if (command == 110) {
                    this.pitchChannelCount = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    this.drumChannelCount = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    this.pitchChannelCount = clamp(Config.pitchChannelCountMin, Config.pitchChannelCountMax + 1, this.pitchChannelCount);
                    this.drumChannelCount = clamp(Config.drumChannelCountMin, Config.drumChannelCountMax + 1, this.drumChannelCount);
                    for (let channelIndex = this.channels.length; channelIndex < this.getChannelCount(); channelIndex++) {
                        this.channels[channelIndex] = new Channel();
                    }
                    this.channels.length = this.getChannelCount();
                }
                else if (command == 115) {
                    this.scale = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    if ((fromOld && beforeThree) && this.scale == 10)
                        this.scale = 11;
                }
                else if (command == 117) {
                    this.mix = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                }
                else if (command == 107) {
                    this.key = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                }
                else if (command == 122) {
                    if (fromOld) {
                        var themeIndex = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        var themes = ["none", "modbox2", "artic", "Cinnamon Roll", "Ocean", "rainbow", "float", "windows", "grassland", "dessert", "kahootiest", "beambit", "egg", "Poniryoshka", "gameboy", "woodkid", "midnight", "snedbox", "unnamed", "piano", "halloween", "frozen"];
                        this.setSongTheme = themes[themeIndex];
                    }
                    else {
                        var songThemeLength = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        this.setSongTheme = decodeURIComponent(compressed.substring(charIndex, charIndex + songThemeLength));
                        charIndex += songThemeLength;
                    }
                }
                else if (command == 108) {
                    if (fromOld && beforeFive) {
                        this.loopStart = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    }
                    else {
                        this.loopStart = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    }
                }
                else if (command == 101) {
                    if (fromOld && beforeFive) {
                        this.loopLength = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    }
                    else {
                        this.loopLength = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
                    }
                }
                else if (command == 116) {
                    if (fromOld && beforeFour) {
                        this.tempo = [1, 4, 7, 10][base64CharCodeToInt[compressed.charCodeAt(charIndex++)]];
                    }
                    else {
                        this.tempo = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    }
                    this.tempo = clamp(0, Config.tempoSteps, this.tempo);
                }
                else if (command == 109) {
                    this.reverb = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    this.reverb = clamp(0, Config.reverbRange, this.reverb);
                }
                else if (command == 120) {
                    this.blend = clamp(0, Config.blendRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
                else if (command == 121) {
                    this.riff = clamp(0, Config.riffRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
                else if (command == 124) {
                    this.sampleRate = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                }
                else if (command == 72) {
                    this.detune = clamp(0, Config.detuneRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
                else if (command == 36) {
                    this.muff = clamp(0, Config.muffRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
                else if (command == 97) {
                    if (fromOld && beforeThree) {
                        this.beatsPerBar = [6, 7, 8, 9, 10][base64CharCodeToInt[compressed.charCodeAt(charIndex++)]];
                    }
                    else {
                        this.beatsPerBar = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
                    }
                    this.beatsPerBar = Math.max(Config.beatsPerBarMin, Math.min(Config.beatsPerBarMax, this.beatsPerBar));
                }
                else if (command == 103) {
                    this.barCount = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
                    this.barCount = Math.max(Config.barCountMin, Math.min(Config.barCountMax, this.barCount));
                    for (let channel = 0; channel < this.getChannelCount(); channel++) {
                        for (let bar = this.channels[channel].bars.length; bar < this.barCount; bar++) {
                            this.channels[channel].bars[bar] = 1;
                        }
                        this.channels[channel].bars.length = this.barCount;
                    }
                }
                else if (command == 106) {
                    this.patternsPerChannel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
                    this.patternsPerChannel = Math.max(1, Math.min(Config.barCountMax, this.patternsPerChannel));
                    for (let channel = 0; channel < this.getChannelCount(); channel++) {
                        for (let pattern = this.channels[channel].patterns.length; pattern < this.patternsPerChannel; pattern++) {
                            this.channels[channel].patterns[pattern] = new Pattern();
                        }
                        this.channels[channel].patterns.length = this.patternsPerChannel;
                    }
                }
                else if (command == 105) {
                    this.instrumentsPerChannel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
                    this.instrumentsPerChannel = Math.max(Config.instrumentsPerChannelMin, Math.min(Config.instrumentsPerChannelMax, this.instrumentsPerChannel));
                    for (let channel = 0; channel < this.getChannelCount(); channel++) {
                        for (let instrument = this.channels[channel].instruments.length; instrument < this.instrumentsPerChannel; instrument++) {
                            this.channels[channel].instruments[instrument] = new Instrument();
                        }
                        this.channels[channel].instruments.length = this.instrumentsPerChannel;
                    }
                }
                else if (command == 114) {
                    this.partsPerBeat = Config.partCounts[base64CharCodeToInt[compressed.charCodeAt(charIndex++)]];
                }
                else if (command == 111) {
                    if (fromOld && beforeThree) {
                        channel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        this.channels[channel].octave = clamp(0, 5, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                    else {
                        for (channel = 0; channel < this.getChannelCount(); channel++) {
                            this.channels[channel].octave = clamp(0, 5, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        }
                    }
                }
                else if (command == 84) {
                    instrumentIndexIterator++;
                    if (instrumentIndexIterator >= this.instrumentsPerChannel) {
                        instrumentChannelIterator++;
                        instrumentIndexIterator = 0;
                    }
                    const isPitchChannel = instrumentChannelIterator < this.pitchChannelCount;
                    const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                    const rawInstrumentType = clamp(0, 4, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    let instrumentType = rawInstrumentType;
                    if (instrumentType == 2 && isPitchChannel) {
                        instrumentType = 3;
                    }
                    instrument.setTypeAndReset(instrumentType);
                }
                else if (command == 119) {
                    if (fromOld && beforeThree) {
                        channel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        this.channels[channel].instruments[0].wave = clamp(0, Config.waveNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                    else if (fromOld && beforeSix) {
                        for (channel = 0; channel < this.getChannelCount(); channel++) {
                            const isDrums = (channel >= this.pitchChannelCount);
                            for (let i = 0; i < this.instrumentsPerChannel; i++) {
                                this.channels[channel].instruments[i].wave = clamp(0, isDrums ? Config.drumNames.length : Config.waveNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            }
                        }
                    }
                    else {
                        const isDrums = (instrumentChannelIterator >= this.pitchChannelCount);
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].wave = clamp(0, isDrums ? Config.drumNames.length : Config.waveNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                }
                else if (command == 102) {
                    if (fromOld && beforeThree) {
                        channel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        this.channels[channel].instruments[0].filter = [1, 3, 4, 5][clamp(0, Config.filterNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)])];
                    }
                    else if (fromOld && beforeSix) {
                        for (channel = 0; channel < this.getChannelCount(); channel++) {
                            for (let i = 0; i < this.instrumentsPerChannel; i++) {
                                this.channels[channel].instruments[i].filter = clamp(0, Config.filterNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1);
                            }
                        }
                    }
                    else {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].filter = clamp(0, Config.filterNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                }
                else if (command == 100) {
                    if (fromOld && beforeThree) {
                        channel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        this.channels[channel].instruments[0].transition = clamp(0, Config.transitionNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                    else if (fromOld && beforeSix) {
                        for (channel = 0; channel < this.getChannelCount(); channel++) {
                            for (let i = 0; i < this.instrumentsPerChannel; i++) {
                                this.channels[channel].instruments[i].transition = clamp(0, Config.transitionNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            }
                        }
                    }
                    else {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].transition = clamp(0, Config.transitionNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                }
                else if (command == 99) {
                    if (fromOld && beforeThree) {
                        channel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        let effect = clamp(0, Config.effectNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        if (effect == 1)
                            effect = 3;
                        else if (effect == 3)
                            effect = 5;
                        this.channels[channel].instruments[0].effect = effect;
                    }
                    else if (fromOld && beforeSix) {
                        for (channel = 0; channel < this.getChannelCount(); channel++) {
                            for (let i = 0; i < this.instrumentsPerChannel; i++) {
                                this.channels[channel].instruments[i].effect = clamp(0, Config.effectNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            }
                        }
                    }
                    else {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].effect = clamp(0, Config.effectNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                }
                else if (command == 104) {
                    if (fromOld && beforeThree) {
                        channel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        this.channels[channel].instruments[0].chorus = clamp(0, Config.chorusNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                    else if (fromOld && beforeSix) {
                        for (channel = 0; channel < this.getChannelCount(); channel++) {
                            for (let i = 0; i < this.instrumentsPerChannel; i++) {
                                this.channels[channel].instruments[i].chorus = clamp(0, Config.chorusNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            }
                        }
                    }
                    else {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chorus = clamp(0, Config.chorusNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                }
                else if (command == 113) {
                    if (fromOld && beforeSix) {
                        for (channel = 0; channel < this.getChannelCount(); channel++) {
                            for (let i = 0; i < this.instrumentsPerChannel; i++) {
                                this.channels[channel].instruments[i].harm = clamp(0, Config.harmNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            }
                        }
                    }
                    else {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].harm = clamp(0, Config.harmNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                }
                else if (command == 35) {
                    this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].fmChorus = clamp(0, Config.fmChorusNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
                else if (command == 71) {
                    this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].imute = clamp(0, Config.imuteNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
                else if (command == 76) {
                    this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].ipan = clamp(0, Config.ipanValues.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
                else if (command == 66) {
                    if (fromOld && beforeSix) {
                        for (channel = 0; channel < this.getChannelCount(); channel++) {
                            for (let i = 0; i < this.instrumentsPerChannel; i++) {
                                this.channels[channel].instruments[i].octoff = clamp(0, Config.octoffNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            }
                        }
                    }
                    else {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].octoff = clamp(0, Config.octoffNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                }
                else if (command == 118) {
                    if (fromOld && beforeThree) {
                        channel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        this.channels[channel].instruments[0].volume = clamp(0, Config.volumeNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                    else if (fromOld && beforeSix) {
                        for (channel = 0; channel < this.getChannelCount(); channel++) {
                            for (let i = 0; i < this.instrumentsPerChannel; i++) {
                                this.channels[channel].instruments[i].volume = clamp(0, Config.volumeNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            }
                        }
                    }
                    else {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].volume = clamp(0, Config.volumeNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                }
                else if (command == 65) {
                    this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].algorithm = clamp(0, Config.operatorAlgorithmNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
                else if (command == 70) {
                    this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].feedbackType = clamp(0, Config.operatorFeedbackNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
                else if (command == 95) {
                    this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].feedbackAmplitude = clamp(0, Config.operatorAmplitudeMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
                else if (command == 86) {
                    this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].feedbackEnvelope = clamp(0, Config.operatorEnvelopeNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
                else if (command == 81) {
                    for (let o = 0; o < Config.operatorCount; o++) {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].operators[o].frequency = clamp(0, Config.operatorFrequencyNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                }
                else if (command == 80) {
                    for (let o = 0; o < Config.operatorCount; o++) {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].operators[o].amplitude = clamp(0, Config.operatorAmplitudeMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                }
                else if (command == 69) {
                    for (let o = 0; o < Config.operatorCount; o++) {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].operators[o].envelope = clamp(0, Config.operatorEnvelopeNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                }
                else if (command == 98) {
                    let subStringLength;
                    if (fromOld && beforeThree) {
                        channel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        const barCount = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        subStringLength = Math.ceil(barCount * 0.5);
                        const bits = new BitFieldReader(base64CharCodeToInt, compressed, charIndex, charIndex + subStringLength);
                        for (let i = 0; i < barCount; i++) {
                            this.channels[channel].bars[i] = bits.read(3) + 1;
                        }
                    }
                    else if (fromOld && beforeFive) {
                        let neededBits = 0;
                        while ((1 << neededBits) < this.patternsPerChannel)
                            neededBits++;
                        subStringLength = Math.ceil(this.getChannelCount() * this.barCount * neededBits / 6);
                        const bits = new BitFieldReader(base64CharCodeToInt, compressed, charIndex, charIndex + subStringLength);
                        for (channel = 0; channel < this.getChannelCount(); channel++) {
                            for (let i = 0; i < this.barCount; i++) {
                                this.channels[channel].bars[i] = bits.read(neededBits) + 1;
                            }
                        }
                    }
                    else {
                        let neededBits = 0;
                        while ((1 << neededBits) < this.patternsPerChannel + 1)
                            neededBits++;
                        subStringLength = Math.ceil(this.getChannelCount() * this.barCount * neededBits / 6);
                        const bits = new BitFieldReader(base64CharCodeToInt, compressed, charIndex, charIndex + subStringLength);
                        for (channel = 0; channel < this.getChannelCount(); channel++) {
                            for (let i = 0; i < this.barCount; i++) {
                                this.channels[channel].bars[i] = bits.read(neededBits);
                            }
                        }
                    }
                    charIndex += subStringLength;
                }
                else if (command == 112) {
                    let bitStringLength = 0;
                    if (fromOld && beforeThree) {
                        channel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        charIndex++;
                        bitStringLength = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        bitStringLength = bitStringLength << 6;
                        bitStringLength += base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    }
                    else {
                        channel = 0;
                        let bitStringLengthLength = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        while (bitStringLengthLength > 0) {
                            bitStringLength = bitStringLength << 6;
                            bitStringLength += base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                            bitStringLengthLength--;
                        }
                    }
                    const bits = new BitFieldReader(base64CharCodeToInt, compressed, charIndex, charIndex + bitStringLength);
                    charIndex += bitStringLength;
                    let neededInstrumentBits = 0;
                    while ((1 << neededInstrumentBits) < this.instrumentsPerChannel)
                        neededInstrumentBits++;
                    while (true) {
                        const isDrum = this.getChannelIsDrum(channel);
                        const octaveOffset = isDrum ? 0 : this.channels[channel].octave * 12;
                        let note = null;
                        let pin = null;
                        let lastPitch = (isDrum ? 4 : 12) + octaveOffset;
                        const recentPitches = isDrum ? [4, 6, 7, 2, 3, 8, 0, 10] : [12, 19, 24, 31, 36, 7, 0];
                        const recentShapes = [];
                        for (let i = 0; i < recentPitches.length; i++) {
                            recentPitches[i] += octaveOffset;
                        }
                        for (let i = 0; i < this.patternsPerChannel; i++) {
                            const newPattern = this.channels[channel].patterns[i];
                            newPattern.reset();
                            newPattern.instrument = bits.read(neededInstrumentBits);
                            if (((fromOld && !beforeThree) || fromNepBox) && bits.read(1) == 0)
                                continue;
                            let curPart = 0;
                            const newNotes = newPattern.notes;
                            while (curPart < this.beatsPerBar * this.partsPerBeat) {
                                const useOldShape = bits.read(1) == 1;
                                let newNote = false;
                                let shapeIndex = 0;
                                if (useOldShape) {
                                    shapeIndex = bits.readLongTail(0, 0);
                                }
                                else {
                                    newNote = bits.read(1) == 1;
                                }
                                if (!useOldShape && !newNote) {
                                    const restLength = bits.readPartDuration();
                                    curPart += restLength;
                                }
                                else {
                                    let shape;
                                    let pinObj;
                                    let pitch;
                                    if (useOldShape) {
                                        shape = recentShapes[shapeIndex];
                                        recentShapes.splice(shapeIndex, 1);
                                    }
                                    else {
                                        shape = {};
                                        shape.pitchCount = 1;
                                        while (shape.pitchCount < 4 && bits.read(1) == 1)
                                            shape.pitchCount++;
                                        shape.pinCount = bits.readPinCount();
                                        shape.initialVolume = bits.read(2);
                                        shape.pins = [];
                                        shape.length = 0;
                                        shape.bendCount = 0;
                                        for (let j = 0; j < shape.pinCount; j++) {
                                            pinObj = {};
                                            pinObj.pitchBend = bits.read(1) == 1;
                                            if (pinObj.pitchBend)
                                                shape.bendCount++;
                                            shape.length += bits.readPartDuration();
                                            pinObj.time = shape.length;
                                            pinObj.volume = bits.read(2);
                                            shape.pins.push(pinObj);
                                        }
                                    }
                                    recentShapes.unshift(shape);
                                    if (recentShapes.length > 10)
                                        recentShapes.pop();
                                    note = makeNote(0, curPart, curPart + shape.length, shape.initialVolume);
                                    note.pitches = [];
                                    note.pins.length = 1;
                                    const pitchBends = [];
                                    for (let j = 0; j < shape.pitchCount + shape.bendCount; j++) {
                                        const useOldPitch = bits.read(1) == 1;
                                        if (!useOldPitch) {
                                            const interval = bits.readPitchInterval();
                                            pitch = lastPitch;
                                            let intervalIter = interval;
                                            while (intervalIter > 0) {
                                                pitch++;
                                                while (recentPitches.indexOf(pitch) != -1)
                                                    pitch++;
                                                intervalIter--;
                                            }
                                            while (intervalIter < 0) {
                                                pitch--;
                                                while (recentPitches.indexOf(pitch) != -1)
                                                    pitch--;
                                                intervalIter++;
                                            }
                                        }
                                        else {
                                            const pitchIndex = bits.read(3);
                                            pitch = recentPitches[pitchIndex];
                                            recentPitches.splice(pitchIndex, 1);
                                        }
                                        recentPitches.unshift(pitch);
                                        if (recentPitches.length > 8)
                                            recentPitches.pop();
                                        if (j < shape.pitchCount) {
                                            note.pitches.push(pitch);
                                        }
                                        else {
                                            pitchBends.push(pitch);
                                        }
                                        if (j == shape.pitchCount - 1) {
                                            lastPitch = note.pitches[0];
                                        }
                                        else {
                                            lastPitch = pitch;
                                        }
                                    }
                                    pitchBends.unshift(note.pitches[0]);
                                    for (const pinObj of shape.pins) {
                                        if (pinObj.pitchBend)
                                            pitchBends.shift();
                                        pin = makeNotePin(pitchBends[0] - note.pitches[0], pinObj.time, pinObj.volume);
                                        note.pins.push(pin);
                                    }
                                    curPart = note.end;
                                    newNotes.push(note);
                                }
                            }
                        }
                        if (fromOld && beforeThree) {
                            break;
                        }
                        else {
                            channel++;
                            if (channel >= this.getChannelCount())
                                break;
                        }
                    }
                }
            }
        }
        toJsonObject(enableIntro = true, loopCount = 1, enableOutro = true) {
            const channelArray = [];
            for (let channel = 0; channel < this.getChannelCount(); channel++) {
                const instrumentArray = [];
                const isDrum = this.getChannelIsDrum(channel);
                for (let i = 0; i < this.instrumentsPerChannel; i++) {
                    const instrument = this.channels[channel].instruments[i];
                    if (isDrum) {
                        instrumentArray.push({
                            type: Config.instrumentTypeNames[2],
                            volume: (5 - instrument.volume) * 20,
                            imute: Config.imuteNames[instrument.imute],
                            wave: Config.drumNames[instrument.wave],
                            transition: Config.transitionNames[instrument.transition],
                            octoff: Config.octoffNames[instrument.octoff],
                            ipan: Config.ipanValues[instrument.ipan],
                        });
                    }
                    else {
                        if (instrument.type == 0) {
                            instrumentArray.push({
                                type: Config.instrumentTypeNames[instrument.type],
                                volume: (5 - instrument.volume) * 20,
                                wave: Config.waveNames[instrument.wave],
                                transition: Config.transitionNames[instrument.transition],
                                filter: Config.filterNames[instrument.filter],
                                chorus: Config.chorusNames[instrument.chorus],
                                effect: Config.effectNames[instrument.effect],
                                harm: Config.harmNames[instrument.harm],
                                imute: Config.imuteNames[instrument.imute],
                                octoff: Config.octoffNames[instrument.octoff],
                                ipan: Config.ipanValues[instrument.ipan],
                            });
                        }
                        else if (instrument.type == 1) {
                            const operatorArray = [];
                            for (const operator of instrument.operators) {
                                operatorArray.push({
                                    frequency: Config.operatorFrequencyNames[operator.frequency],
                                    amplitude: operator.amplitude,
                                    envelope: Config.operatorEnvelopeNames[operator.envelope],
                                });
                            }
                            instrumentArray.push({
                                type: Config.instrumentTypeNames[instrument.type],
                                volume: (5 - instrument.volume) * 20,
                                transition: Config.transitionNames[instrument.transition],
                                effect: Config.effectNames[instrument.effect],
                                octoff: Config.octoffNames[instrument.octoff],
                                fmChorus: Config.fmChorusNames[instrument.fmChorus],
                                algorithm: Config.operatorAlgorithmNames[instrument.algorithm],
                                feedbackType: Config.operatorFeedbackNames[instrument.feedbackType],
                                feedbackAmplitude: instrument.feedbackAmplitude,
                                feedbackEnvelope: Config.operatorEnvelopeNames[instrument.feedbackEnvelope],
                                operators: operatorArray,
                                ipan: Config.ipanValues[instrument.ipan],
                                imute: Config.imuteNames[instrument.imute],
                            });
                        }
                        else if (instrument.type == 3) {
                            instrumentArray.push({
                                type: Config.instrumentTypeNames[2],
                                volume: (5 - instrument.volume) * 20,
                                wave: Config.pwmwaveNames[instrument.wave],
                                transition: Config.transitionNames[instrument.transition],
                                filter: Config.filterNames[instrument.filter],
                                chorus: Config.chorusNames[instrument.chorus],
                                effect: Config.effectNames[instrument.effect],
                                harm: Config.harmNames[instrument.harm],
                                imute: Config.imuteNames[instrument.imute],
                                octoff: Config.octoffNames[instrument.octoff],
                                ipan: Config.ipanValues[instrument.ipan],
                            });
                        }
                        else {
                            throw new Error("Unrecognized instrument type");
                        }
                    }
                }
                const patternArray = [];
                for (const pattern of this.channels[channel].patterns) {
                    const noteArray = [];
                    for (const note of pattern.notes) {
                        const pointArray = [];
                        for (const pin of note.pins) {
                            pointArray.push({
                                tick: pin.time + note.start,
                                pitchBend: pin.interval,
                                volume: Math.round(pin.volume * 100 / 3),
                            });
                        }
                        noteArray.push({
                            pitches: note.pitches,
                            points: pointArray,
                        });
                    }
                    patternArray.push({
                        instrument: pattern.instrument + 1,
                        notes: noteArray,
                    });
                }
                const sequenceArray = [];
                if (enableIntro)
                    for (let i = 0; i < this.loopStart; i++) {
                        sequenceArray.push(this.channels[channel].bars[i]);
                    }
                for (let l = 0; l < loopCount; l++)
                    for (let i = this.loopStart; i < this.loopStart + this.loopLength; i++) {
                        sequenceArray.push(this.channels[channel].bars[i]);
                    }
                if (enableOutro)
                    for (let i = this.loopStart + this.loopLength; i < this.barCount; i++) {
                        sequenceArray.push(this.channels[channel].bars[i]);
                    }
                channelArray.push({
                    type: isDrum ? "drum" : "pitch",
                    octaveScrollBar: this.channels[channel].octave,
                    instruments: instrumentArray,
                    patterns: patternArray,
                    sequence: sequenceArray,
                });
            }
            return {
                format: Song._format,
                version: Song._latestNepBoxVersion,
                theme: this.setSongTheme,
                scale: Config.scales[this.scale].name,
                mix: Config.mixNames[this.mix],
                sampleRate: Config.sampleRateNames[this.sampleRate],
                key: Config.keys[this.key].name,
                introBars: this.loopStart,
                loopBars: this.loopLength,
                beatsPerBar: this.beatsPerBar,
                ticksPerBeat: this.partsPerBeat,
                beatsPerMinute: this.getBeatsPerMinute(),
                reverb: this.reverb,
                blend: this.blend,
                riff: this.riff,
                detune: this.detune,
                muff: this.muff,
                channels: channelArray,
            };
        }
        fromJsonObject(jsonObject) {
            this.initToDefault(true);
            if (!jsonObject)
                return;
            const format = jsonObject.format;
            const version = jsonObject.version;
            if (version > Song._format)
                return;
            this.scale = 11;
            if (jsonObject.scale != undefined) {
                if (format == "BeepBox") {
                    const oldScaleNames = { "romani :)": 8, "romani :(": 9 };
                    const scale = oldScaleNames[jsonObject.scale] != undefined ? oldScaleNames[jsonObject.scale] : Config.scales.map(scale => scale.name).indexOf(jsonObject.scale);
                    if (scale != -1)
                        this.scale = scale;
                }
                else {
                    this.scale = Config.scales.map(scale => scale.name).indexOf(jsonObject["scale"]);
                }
            }
            if (jsonObject.theme != undefined) {
                if (format == "BeepBox") {
                    if ((jsonObject["theme"] != "Nepbox") && (jsonObject["theme"] != "Laffey") && (jsonObject["theme"] != "ModBox")) {
                        var themes = ["none", "modbox2", "artic", "Cinnamon Roll", "Ocean", "rainbow", "float", "windows", "grassland", "dessert", "kahootiest", "beambit", "egg", "Poniryoshka", "gameboy", "woodkid", "midnight", "snedbox", "unnamed", "piano", "halloween", "frozen"];
                        var themeIndex = Config.oldThemeNames.indexOf(jsonObject["theme"]);
                        this.setSongTheme = themes[themeIndex];
                    }
                    else {
                        var themes = ["none", "nepbox", "laffey"];
                        var oldThemes = ["ModBox", "Nepbox", "Laffey"];
                        var themeIndex = oldThemes.indexOf(jsonObject["theme"]);
                        this.setSongTheme = themes[themeIndex];
                    }
                }
                else {
                    this.setSongTheme = jsonObject["theme"];
                }
            }
            if (jsonObject.mix != undefined) {
                this.mix = Config.mixNames.indexOf(jsonObject.mix);
                if (this.mix == -1)
                    this.mix = 1;
            }
            if (jsonObject.sampleRate != undefined) {
                this.sampleRate = Config.sampleRateNames.indexOf(jsonObject.sampleRate);
                if (this.sampleRate == -1)
                    this.sampleRate = 2;
            }
            if (jsonObject.key != undefined) {
                if (format == "BeepBox") {
                    if (typeof (jsonObject.key) == "number") {
                        this.key = Config.oldKeys.length - 1 - (((jsonObject.key + 1200) >>> 0) % Config.oldKeys.length);
                    }
                    else if (typeof (jsonObject.key) == "string") {
                        this.key = Config.keys.map(key => key.name).indexOf(jsonObject.key);
                    }
                }
                else {
                    this.key = Config.keys.map(key => key.name).indexOf(jsonObject.key);
                }
            }
            if (jsonObject.beatsPerMinute != undefined) {
                const bpm = jsonObject.beatsPerMinute | 0;
                this.tempo = Math.round(4.0 + 9.0 * Math.log(bpm / 120) / Math.LN2);
                this.tempo = clamp(0, Config.tempoSteps, this.tempo);
            }
            if (jsonObject.reverb != undefined) {
                this.reverb = clamp(0, Config.reverbRange, jsonObject.reverb | 0);
            }
            if (jsonObject.blend != undefined) {
                this.blend = clamp(0, Config.blendRange, jsonObject.blend | 0);
            }
            if (jsonObject.riff != undefined) {
                this.riff = clamp(0, Config.riffRange, jsonObject.riff | 0);
            }
            if (jsonObject.detune != undefined) {
                this.detune = clamp(0, Config.detuneRange, jsonObject.detune | 0);
            }
            if (jsonObject.muff != undefined) {
                this.muff = clamp(0, Config.muffRange, jsonObject.muff | 0);
            }
            if (jsonObject.beatsPerBar != undefined) {
                this.beatsPerBar = Math.max(Config.beatsPerBarMin, Math.min(Config.beatsPerBarMax, jsonObject.beatsPerBar | 0));
            }
            if (jsonObject.ticksPerBeat != undefined) {
                this.partsPerBeat = jsonObject.ticksPerBeat | 0;
                if (Config.partCounts.indexOf(this.partsPerBeat) == -1) {
                    this.partsPerBeat = Config.partCounts[Config.partCounts.length - 1];
                }
            }
            let maxInstruments = 1;
            let maxPatterns = 1;
            let maxBars = 1;
            if (jsonObject.channels) {
                for (const channelObject of jsonObject.channels) {
                    if (channelObject.instruments)
                        maxInstruments = Math.max(maxInstruments, channelObject.instruments.length | 0);
                    if (channelObject.patterns)
                        maxPatterns = Math.max(maxPatterns, channelObject.patterns.length | 0);
                    if (channelObject.sequence)
                        maxBars = Math.max(maxBars, channelObject.sequence.length | 0);
                }
            }
            this.instrumentsPerChannel = maxInstruments;
            this.patternsPerChannel = maxPatterns;
            this.barCount = maxBars;
            if (jsonObject.introBars != undefined) {
                this.loopStart = clamp(0, this.barCount, jsonObject.introBars | 0);
            }
            if (jsonObject.loopBars != undefined) {
                this.loopLength = clamp(1, this.barCount - this.loopStart + 1, jsonObject.loopBars | 0);
            }
            let pitchChannelCount = 0;
            let drumChannelCount = 0;
            if (jsonObject.channels) {
                for (let channel = 0; channel < jsonObject.channels.length; channel++) {
                    let channelObject = jsonObject.channels[channel];
                    if (this.channels.length <= channel)
                        this.channels[channel] = new Channel();
                    if (channelObject.octaveScrollBar != undefined) {
                        this.channels[channel].octave = clamp(0, 5, channelObject.octaveScrollBar | 0);
                    }
                    for (let i = this.channels[channel].instruments.length; i < this.instrumentsPerChannel; i++) {
                        this.channels[channel].instruments[i] = new Instrument();
                    }
                    this.channels[channel].instruments.length = this.instrumentsPerChannel;
                    for (let i = this.channels[channel].patterns.length; i < this.patternsPerChannel; i++) {
                        this.channels[channel].patterns[i] = new Pattern();
                    }
                    this.channels[channel].patterns.length = this.patternsPerChannel;
                    for (let i = 0; i < this.barCount; i++) {
                        this.channels[channel].bars[i] = 1;
                    }
                    this.channels[channel].bars.length = this.barCount;
                    let isDrum = false;
                    if (channelObject.type) {
                        isDrum = (channelObject.type == "drum");
                    }
                    else {
                        isDrum = (channel >= 3);
                    }
                    if (isDrum)
                        drumChannelCount++;
                    else
                        pitchChannelCount++;
                    for (let i = 0; i < this.instrumentsPerChannel; i++) {
                        const instrument = this.channels[channel].instruments[i];
                        let instrumentObject = undefined;
                        if (channelObject.instruments)
                            instrumentObject = channelObject.instruments[i];
                        if (instrumentObject == undefined)
                            instrumentObject = {};
                        const oldTransitionNames = { "binary": 0 };
                        const transitionObject = instrumentObject.transition || instrumentObject.envelope;
                        instrument.transition = oldTransitionNames[transitionObject] != undefined ? oldTransitionNames[transitionObject] : Config.transitionNames.indexOf(transitionObject);
                        if (instrument.transition == -1)
                            instrument.transition = 1;
                        if (isDrum) {
                            if (instrumentObject.volume != undefined) {
                                instrument.volume = clamp(0, Config.volumeNames.length, Math.round(5 - (instrumentObject.volume | 0) / 20));
                            }
                            else {
                                instrument.volume = 0;
                            }
                            instrument.wave = Config.drumNames.indexOf(instrumentObject.wave);
                            if (instrument.wave == -1)
                                instrument.wave = 1;
                            instrument.imute = Config.imuteNames.indexOf(instrumentObject.imute);
                            if (instrument.imute == -1)
                                instrument.imute = 0;
                            instrument.ipan = Config.ipanValues.indexOf(instrumentObject.ipan);
                            if (instrument.ipan == -1)
                                instrument.ipan = 4;
                        }
                        else {
                            instrument.type = Config.instrumentTypeNames.indexOf(instrumentObject.type);
                            if (instrument.type == null)
                                instrument.type = 0;
                            if (instrument.type == 0) {
                                if (instrumentObject.volume != undefined) {
                                    instrument.volume = clamp(0, Config.volumeNames.length, Math.round(5 - (instrumentObject.volume | 0) / 20));
                                }
                                else {
                                    instrument.volume = 0;
                                }
                                instrument.wave = Config.waveNames.indexOf(instrumentObject.wave);
                                if (instrument.wave == -1)
                                    instrument.wave = 1;
                                const oldFilterNames = { "sustain sharp": 1, "sustain medium": 2, "sustain soft": 3, "decay sharp": 4 };
                                instrument.filter = oldFilterNames[instrumentObject.filter] != undefined ? oldFilterNames[instrumentObject.filter] : Config.filterNames.indexOf(instrumentObject.filter);
                                if (instrument.filter == -1)
                                    instrument.filter = 0;
                                instrument.chorus = Config.chorusNames.indexOf(instrumentObject.chorus);
                                if (instrument.chorus == -1)
                                    instrument.chorus = 0;
                                instrument.effect = Config.effectNames.indexOf(instrumentObject.effect);
                                if (instrument.effect == -1)
                                    instrument.effect = 0;
                                instrument.harm = Config.harmNames.indexOf(instrumentObject.harm);
                                if (instrument.harm == -1)
                                    instrument.harm = 0;
                                instrument.octoff = Config.octoffNames.indexOf(instrumentObject.octoff);
                                if (instrument.octoff == -1)
                                    instrument.octoff = 0;
                                instrument.imute = Config.imuteNames.indexOf(instrumentObject.imute);
                                if (instrument.imute == -1)
                                    instrument.imute = 0;
                                instrument.ipan = Config.ipanValues.indexOf(instrumentObject.ipan);
                                if (instrument.ipan == -1)
                                    instrument.ipan = 4;
                            }
                            else if (instrument.type == 3
                                || instrument.type == 2) {
                                if (instrument.type == 2) {
                                    instrument.type = 3;
                                }
                                if (instrumentObject.volume != undefined) {
                                    instrument.volume = clamp(0, Config.volumeNames.length, Math.round(5 - (instrumentObject.volume | 0) / 20));
                                }
                                else {
                                    instrument.volume = 0;
                                }
                                instrument.wave = Config.pwmwaveNames.indexOf(instrumentObject.wave);
                                if (instrument.wave == -1)
                                    instrument.wave = 1;
                                const oldFilterNames = { "sustain sharp": 1, "sustain medium": 2, "sustain soft": 3, "decay sharp": 4 };
                                instrument.filter = oldFilterNames[instrumentObject.filter] != undefined ? oldFilterNames[instrumentObject.filter] : Config.filterNames.indexOf(instrumentObject.filter);
                                if (instrument.filter == -1)
                                    instrument.filter = 0;
                                instrument.chorus = Config.chorusNames.indexOf(instrumentObject.chorus);
                                if (instrument.chorus == -1)
                                    instrument.chorus = 0;
                                instrument.effect = Config.effectNames.indexOf(instrumentObject.effect);
                                if (instrument.effect == -1)
                                    instrument.effect = 0;
                                instrument.harm = Config.harmNames.indexOf(instrumentObject.harm);
                                if (instrument.harm == -1)
                                    instrument.harm = 0;
                                instrument.octoff = Config.octoffNames.indexOf(instrumentObject.octoff);
                                if (instrument.octoff == -1)
                                    instrument.octoff = 0;
                                instrument.imute = Config.imuteNames.indexOf(instrumentObject.imute);
                                if (instrument.imute == -1)
                                    instrument.imute = 0;
                                instrument.ipan = Config.ipanValues.indexOf(instrumentObject.ipan);
                                if (instrument.ipan == -1)
                                    instrument.ipan = 4;
                            }
                            else if (instrument.type == 1) {
                                instrument.effect = Config.effectNames.indexOf(instrumentObject.effect);
                                if (instrument.effect == -1)
                                    instrument.effect = 0;
                                instrument.octoff = Config.octoffNames.indexOf(instrumentObject.octoff);
                                if (instrument.octoff == -1)
                                    instrument.octoff = 0;
                                instrument.fmChorus = Config.fmChorusNames.indexOf(instrumentObject.fmChorus);
                                if (instrument.fmChorus == -1)
                                    instrument.fmChorus = 0;
                                instrument.algorithm = Config.operatorAlgorithmNames.indexOf(instrumentObject.algorithm);
                                if (instrument.algorithm == -1)
                                    instrument.algorithm = 0;
                                instrument.feedbackType = Config.operatorFeedbackNames.indexOf(instrumentObject.feedbackType);
                                if (instrument.feedbackType == -1)
                                    instrument.feedbackType = 0;
                                if (instrumentObject.feedbackAmplitude != undefined) {
                                    instrument.feedbackAmplitude = clamp(0, Config.operatorAmplitudeMax + 1, instrumentObject.feedbackAmplitude | 0);
                                }
                                else {
                                    instrument.feedbackAmplitude = 0;
                                }
                                instrument.feedbackEnvelope = Config.operatorEnvelopeNames.indexOf(instrumentObject.feedbackEnvelope);
                                if (instrument.feedbackEnvelope == -1)
                                    instrument.feedbackEnvelope = 0;
                                for (let j = 0; j < Config.operatorCount; j++) {
                                    const operator = instrument.operators[j];
                                    let operatorObject = undefined;
                                    if (instrumentObject.operators)
                                        operatorObject = instrumentObject.operators[j];
                                    if (operatorObject == undefined)
                                        operatorObject = {};
                                    operator.frequency = Config.operatorFrequencyNames.indexOf(operatorObject.frequency);
                                    if (operator.frequency == -1)
                                        operator.frequency = 0;
                                    if (operatorObject.amplitude != undefined) {
                                        operator.amplitude = clamp(0, Config.operatorAmplitudeMax + 1, operatorObject.amplitude | 0);
                                    }
                                    else {
                                        operator.amplitude = 0;
                                    }
                                    operator.envelope = Config.operatorEnvelopeNames.indexOf(operatorObject.envelope);
                                    if (operator.envelope == -1)
                                        operator.envelope = 0;
                                }
                                instrument.ipan = Config.ipanValues.indexOf(instrumentObject.ipan);
                                if (instrument.ipan == -1)
                                    instrument.ipan = 4;
                                instrument.imute = Config.imuteNames.indexOf(instrumentObject.imute);
                                if (instrument.imute == -1)
                                    instrument.imute = 0;
                            }
                            else {
                                throw new Error("Unrecognized instrument type.");
                            }
                        }
                    }
                    for (let i = 0; i < this.patternsPerChannel; i++) {
                        const pattern = this.channels[channel].patterns[i];
                        let patternObject = undefined;
                        if (channelObject.patterns)
                            patternObject = channelObject.patterns[i];
                        if (patternObject == undefined)
                            continue;
                        pattern.instrument = clamp(0, this.instrumentsPerChannel, (patternObject.instrument | 0) - 1);
                        if (patternObject.notes && patternObject.notes.length > 0) {
                            const maxNoteCount = Math.min(this.beatsPerBar * this.partsPerBeat, patternObject.notes.length >>> 0);
                            let tickClock = 0;
                            for (let j = 0; j < patternObject.notes.length; j++) {
                                if (j >= maxNoteCount)
                                    break;
                                const noteObject = patternObject.notes[j];
                                if (!noteObject || !noteObject.pitches || !(noteObject.pitches.length >= 1) || !noteObject.points || !(noteObject.points.length >= 2)) {
                                    continue;
                                }
                                const note = makeNote(0, 0, 0, 0);
                                note.pitches = [];
                                note.pins = [];
                                for (let k = 0; k < noteObject.pitches.length; k++) {
                                    const pitch = noteObject.pitches[k] | 0;
                                    if (note.pitches.indexOf(pitch) != -1)
                                        continue;
                                    note.pitches.push(pitch);
                                    if (note.pitches.length >= 4)
                                        break;
                                }
                                if (note.pitches.length < 1)
                                    continue;
                                let noteClock = tickClock;
                                let startInterval = 0;
                                for (let k = 0; k < noteObject.points.length; k++) {
                                    const pointObject = noteObject.points[k];
                                    if (pointObject == undefined || pointObject.tick == undefined)
                                        continue;
                                    const interval = (pointObject.pitchBend == undefined) ? 0 : (pointObject.pitchBend | 0);
                                    const time = pointObject.tick | 0;
                                    const volume = (pointObject.volume == undefined) ? 3 : Math.max(0, Math.min(3, Math.round((pointObject.volume | 0) * 3 / 100)));
                                    if (time > this.beatsPerBar * this.partsPerBeat)
                                        continue;
                                    if (note.pins.length == 0) {
                                        if (time < noteClock)
                                            continue;
                                        note.start = time;
                                        startInterval = interval;
                                    }
                                    else {
                                        if (time <= noteClock)
                                            continue;
                                    }
                                    noteClock = time;
                                    note.pins.push(makeNotePin(interval - startInterval, time - note.start, volume));
                                }
                                if (note.pins.length < 2)
                                    continue;
                                note.end = note.pins[note.pins.length - 1].time + note.start;
                                const maxPitch = isDrum ? Config.drumCount - 1 : Config.maxPitch;
                                let lowestPitch = maxPitch;
                                let highestPitch = 0;
                                for (let k = 0; k < note.pitches.length; k++) {
                                    note.pitches[k] += startInterval;
                                    if (note.pitches[k] < 0 || note.pitches[k] > maxPitch) {
                                        note.pitches.splice(k, 1);
                                        k--;
                                    }
                                    if (note.pitches[k] < lowestPitch)
                                        lowestPitch = note.pitches[k];
                                    if (note.pitches[k] > highestPitch)
                                        highestPitch = note.pitches[k];
                                }
                                if (note.pitches.length < 1)
                                    continue;
                                for (let k = 0; k < note.pins.length; k++) {
                                    const pin = note.pins[k];
                                    if (pin.interval + lowestPitch < 0)
                                        pin.interval = -lowestPitch;
                                    if (pin.interval + highestPitch > maxPitch)
                                        pin.interval = maxPitch - highestPitch;
                                    if (k >= 2) {
                                        if (pin.interval == note.pins[k - 1].interval &&
                                            pin.interval == note.pins[k - 2].interval &&
                                            pin.volume == note.pins[k - 1].volume &&
                                            pin.volume == note.pins[k - 2].volume) {
                                            note.pins.splice(k - 1, 1);
                                            k--;
                                        }
                                    }
                                }
                                pattern.notes.push(note);
                                tickClock = note.end;
                            }
                        }
                    }
                    for (let i = 0; i < this.barCount; i++) {
                        this.channels[channel].bars[i] = channelObject.sequence ? Math.min(this.patternsPerChannel, channelObject.sequence[i] >>> 0) : 0;
                    }
                }
            }
            this.pitchChannelCount = pitchChannelCount;
            this.drumChannelCount = drumChannelCount;
            this.channels.length = this.getChannelCount();
        }
        getPattern(channel, bar) {
            const patternIndex = this.channels[channel].bars[bar];
            if (patternIndex == 0)
                return null;
            return this.channels[channel].patterns[patternIndex - 1];
        }
        getPatternInstrument(channel, bar) {
            const pattern = this.getPattern(channel, bar);
            return pattern == null ? 0 : pattern.instrument;
        }
        getPatternInstrumentMute(channel, bar) {
            const pattern = this.getPattern(channel, bar);
            const instrumentIndex = this.getPatternInstrument(channel, bar);
            const instrument = this.channels[channel].instruments[instrumentIndex];
            return pattern == null ? 0 : instrument.imute;
        }
        getPatternInstrumentVolume(channel, bar) {
            const pattern = this.getPattern(channel, bar);
            const instrumentIndex = this.getPatternInstrument(channel, bar);
            const instrument = this.channels[channel].instruments[instrumentIndex];
            return pattern == null ? 0 : instrument.volume;
        }
        getBeatsPerMinute() {
            return Math.round(120.0 * Math.pow(2.0, (-4.0 + this.tempo) / 9.0));
        }
        getChannelFingerprint(bar) {
            const channelCount = this.getChannelCount();
            let charCount = 0;
            for (let channel = 0; channel < channelCount; channel++) {
                if (channel < this.pitchChannelCount) {
                    const instrumentIndex = this.getPatternInstrument(channel, bar);
                    const instrument = this.channels[channel].instruments[instrumentIndex];
                    if (instrument.type == 0) {
                        this._fingerprint[charCount++] = "c";
                    }
                    else if (instrument.type == 1) {
                        this._fingerprint[charCount++] = "f";
                        this._fingerprint[charCount++] = instrument.algorithm;
                        this._fingerprint[charCount++] = instrument.feedbackType;
                    }
                    else if (instrument.type == 3) {
                        this._fingerprint[charCount++] = "p";
                    }
                    else {
                        throw new Error("Unknown instrument type.");
                    }
                }
                else {
                    this._fingerprint[charCount++] = "d";
                }
            }
            this._fingerprint.length = charCount;
            return this._fingerprint.join("");
        }
    }
    Song._format = "NepBox";
    Song._oldestBeepboxVersion = 2;
    Song._latestBeepboxVersion = 6;
    Song._oldestNepBoxVersion = 1;
    Song._latestNepBoxVersion = 1;
    Song._variant = 0x6E;
    Song._base64CharCodeToInt = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 62, 62, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 0, 0, 0, 0, 0, 0, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 0, 0, 0, 0, 63, 0, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 0, 0, 0, 0, 0];
    Song._base64IntToCharCode = [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 45, 95];

    class Change {
        constructor() {
            this._noop = true;
        }
        _didSomething() {
            this._noop = false;
        }
        isNoop() {
            return this._noop;
        }
        commit() { }
    }
    class UndoableChange extends Change {
        constructor(reversed) {
            super();
            this._reversed = reversed;
            this._doneForwards = !reversed;
        }
        undo() {
            if (this._reversed) {
                this._doForwards();
                this._doneForwards = true;
            }
            else {
                this._doBackwards();
                this._doneForwards = false;
            }
        }
        redo() {
            if (this._reversed) {
                this._doBackwards();
                this._doneForwards = false;
            }
            else {
                this._doForwards();
                this._doneForwards = true;
            }
        }
        _isDoneForwards() {
            return this._doneForwards;
        }
        _doForwards() {
            throw new Error("Change.doForwards(): Override me.");
        }
        _doBackwards() {
            throw new Error("Change.doBackwards(): Override me.");
        }
    }
    class ChangeGroup extends Change {
        constructor() {
            super();
        }
        append(change) {
            if (change.isNoop())
                return;
            this._didSomething();
        }
    }
    class ChangeSequence extends UndoableChange {
        constructor(changes) {
            super(false);
            if (changes == undefined) {
                this._changes = [];
            }
            else {
                this._changes = changes.concat();
            }
        }
        append(change) {
            if (change.isNoop())
                return;
            this._changes[this._changes.length] = change;
            this._didSomething();
        }
        _doForwards() {
            for (let i = 0; i < this._changes.length; i++) {
                this._changes[i].redo();
            }
        }
        _doBackwards() {
            for (let i = this._changes.length - 1; i >= 0; i--) {
                this._changes[i].undo();
            }
        }
    }

    class ChangePins extends UndoableChange {
        constructor(_doc, _note) {
            super(false);
            this._doc = _doc;
            this._note = _note;
            this._oldStart = this._note.start;
            this._oldEnd = this._note.end;
            this._newStart = this._note.start;
            this._newEnd = this._note.end;
            this._oldPins = this._note.pins;
            this._newPins = [];
            this._oldPitches = this._note.pitches;
            this._newPitches = [];
        }
        _finishSetup() {
            for (let i = 0; i < this._newPins.length - 1;) {
                if (this._newPins[i].time >= this._newPins[i + 1].time) {
                    this._newPins.splice(i, 1);
                }
                else {
                    i++;
                }
            }
            for (let i = 1; i < this._newPins.length - 1;) {
                if (this._newPins[i - 1].interval == this._newPins[i].interval &&
                    this._newPins[i].interval == this._newPins[i + 1].interval &&
                    this._newPins[i - 1].volume == this._newPins[i].volume &&
                    this._newPins[i].volume == this._newPins[i + 1].volume) {
                    this._newPins.splice(i, 1);
                }
                else {
                    i++;
                }
            }
            const firstInterval = this._newPins[0].interval;
            const firstTime = this._newPins[0].time;
            for (let i = 0; i < this._oldPitches.length; i++) {
                this._newPitches[i] = this._oldPitches[i] + firstInterval;
            }
            for (let i = 0; i < this._newPins.length; i++) {
                this._newPins[i].interval -= firstInterval;
                this._newPins[i].time -= firstTime;
            }
            this._newStart = this._oldStart + firstTime;
            this._newEnd = this._newStart + this._newPins[this._newPins.length - 1].time;
            this._doForwards();
            this._didSomething();
        }
        _doForwards() {
            this._note.pins = this._newPins;
            this._note.pitches = this._newPitches;
            this._note.start = this._newStart;
            this._note.end = this._newEnd;
            this._doc.notifier.changed();
        }
        _doBackwards() {
            this._note.pins = this._oldPins;
            this._note.pitches = this._oldPitches;
            this._note.start = this._oldStart;
            this._note.end = this._oldEnd;
            this._doc.notifier.changed();
        }
    }
    class ChangeInstrumentType extends Change {
        constructor(doc, newValue) {
            super();
            const oldValue = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].type;
            if (oldValue != newValue) {
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].type = newValue;
                if (newValue == 0) {
                    const instrument = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()];
                    instrument.wave = Math.max(0, Math.min(Config.waves.length - 1, instrument.wave));
                }
                else if (newValue == 3) {
                    const instrument = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()];
                    instrument.wave = Math.max(0, Math.min(Config.pwmwaves.length - 1, instrument.wave));
                }
                doc.notifier.changed();
                this._didSomething();
            }
        }
    }
    class ChangeTransition extends Change {
        constructor(doc, newValue) {
            super();
            const oldValue = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].transition;
            if (oldValue != newValue) {
                this._didSomething();
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].transition = newValue;
                doc.notifier.changed();
            }
        }
    }
    class ChangePattern extends Change {
        constructor(doc, oldValue, newValue) {
            super();
            this.oldValue = oldValue;
            if (newValue > doc.song.patternsPerChannel)
                throw new Error("invalid pattern");
            doc.song.channels[doc.channel].bars[doc.bar] = newValue;
            doc.notifier.changed();
            if (oldValue != newValue)
                this._didSomething();
        }
    }
    class ChangeBarCount extends Change {
        constructor(doc, newValue) {
            super();
            if (doc.song.barCount != newValue) {
                for (let channel = 0; channel < doc.song.getChannelCount(); channel++) {
                    for (let bar = doc.song.barCount; bar < newValue; bar++) {
                        doc.song.channels[channel].bars[bar] = 0;
                    }
                    doc.song.channels[channel].bars.length = newValue;
                }
                let newBar = doc.bar;
                let newBarScrollPos = doc.barScrollPos;
                let newLoopStart = doc.song.loopStart;
                let newLoopLength = doc.song.loopLength;
                if (doc.song.barCount > newValue) {
                    newBar = Math.min(newBar, newValue - 1);
                    newBarScrollPos = Math.max(0, Math.min(newValue - doc.trackVisibleBars, newBarScrollPos));
                    newLoopLength = Math.min(newValue, newLoopLength);
                    newLoopStart = Math.min(newValue - newLoopLength, newLoopStart);
                }
                doc.bar = newBar;
                doc.barScrollPos = newBarScrollPos;
                doc.song.loopStart = newLoopStart;
                doc.song.loopLength = newLoopLength;
                doc.song.barCount = newValue;
                doc.notifier.changed();
                this._didSomething();
            }
        }
    }
    class ChangeInsertBars extends Change {
        constructor(doc, start, count) {
            super();
            const newLength = Math.min(Config.barCountMax, doc.song.barCount + count);
            count = newLength - doc.song.barCount;
            if (count == 0)
                return;
            for (const channel of doc.song.channels) {
                while (channel.bars.length < newLength) {
                    channel.bars.splice(start, 0, 0);
                }
            }
            doc.song.barCount = newLength;
            doc.bar += count;
            doc.barScrollPos += count;
            if (doc.song.loopStart >= start) {
                doc.song.loopStart += count;
            }
            else if (doc.song.loopStart + doc.song.loopLength >= start) {
                doc.song.loopLength += count;
            }
            doc.notifier.changed();
            this._didSomething();
        }
    }
    class ChangeDeleteBars extends Change {
        constructor(doc, start, count) {
            super();
            for (const channel of doc.song.channels) {
                channel.bars.splice(start, count);
                if (channel.bars.length == 0)
                    channel.bars.push(0);
            }
            doc.song.barCount = Math.max(1, doc.song.barCount - count);
            doc.bar = Math.max(0, doc.bar - count);
            doc.barScrollPos = Math.max(0, doc.barScrollPos - count);
            if (doc.song.loopStart >= start) {
                doc.song.loopStart = Math.max(0, doc.song.loopStart - count);
            }
            else if (doc.song.loopStart + doc.song.loopLength > start) {
                doc.song.loopLength -= count;
            }
            doc.song.loopLength = Math.max(1, Math.min(doc.song.barCount - doc.song.loopStart, doc.song.loopLength));
            doc.notifier.changed();
            this._didSomething();
        }
    }
    class ChangeChannelCount extends Change {
        constructor(doc, newPitchChannelCount, newDrumChannelCount) {
            super();
            if (doc.song.pitchChannelCount != newPitchChannelCount || doc.song.drumChannelCount != newDrumChannelCount) {
                const newChannels = [];
                for (let i = 0; i < newPitchChannelCount; i++) {
                    const channel = i;
                    const oldChannel = i;
                    if (i < doc.song.pitchChannelCount) {
                        newChannels[channel] = doc.song.channels[oldChannel];
                    }
                    else {
                        newChannels[channel] = new Channel();
                        newChannels[channel].octave = 2;
                        for (let j = 0; j < doc.song.instrumentsPerChannel; j++)
                            newChannels[channel].instruments[j] = new Instrument();
                        for (let j = 0; j < doc.song.patternsPerChannel; j++)
                            newChannels[channel].patterns[j] = new Pattern();
                        for (let j = 0; j < doc.song.barCount; j++)
                            newChannels[channel].bars[j] = 0;
                    }
                }
                for (let i = 0; i < newDrumChannelCount; i++) {
                    const channel = i + newPitchChannelCount;
                    const oldChannel = i + doc.song.pitchChannelCount;
                    if (i < doc.song.drumChannelCount) {
                        newChannels[channel] = doc.song.channels[oldChannel];
                    }
                    else {
                        newChannels[channel] = new Channel();
                        newChannels[channel].octave = 0;
                        for (let j = 0; j < doc.song.instrumentsPerChannel; j++)
                            newChannels[channel].instruments[j] = new Instrument();
                        for (let j = 0; j < doc.song.patternsPerChannel; j++)
                            newChannels[channel].patterns[j] = new Pattern();
                        for (let j = 0; j < doc.song.barCount; j++)
                            newChannels[channel].bars[j] = 0;
                    }
                }
                doc.song.pitchChannelCount = newPitchChannelCount;
                doc.song.drumChannelCount = newDrumChannelCount;
                for (let channel = 0; channel < doc.song.getChannelCount(); channel++) {
                    doc.song.channels[channel] = newChannels[channel];
                }
                doc.song.channels.length = doc.song.getChannelCount();
                doc.channel = Math.min(doc.channel, newPitchChannelCount + newDrumChannelCount - 1);
                doc.notifier.changed();
                this._didSomething();
            }
        }
    }
    class ChangeBeatsPerBar extends Change {
        constructor(doc, newValue) {
            super();
            if (doc.song.beatsPerBar != newValue) {
                if (doc.song.beatsPerBar > newValue) {
                    const sequence = new ChangeSequence();
                    for (let i = 0; i < doc.song.getChannelCount(); i++) {
                        for (let j = 0; j < doc.song.channels[i].patterns.length; j++) {
                            sequence.append(new ChangeNoteTruncate(doc, doc.song.channels[i].patterns[j], newValue * doc.song.partsPerBeat, doc.song.beatsPerBar * doc.song.partsPerBeat));
                        }
                    }
                }
                doc.song.beatsPerBar = newValue;
                doc.notifier.changed();
                this._didSomething();
            }
        }
    }
    class ChangeChannelOrder extends Change {
        constructor(doc, selectionMin, selectionMax, offset) {
            super();
            doc.song.channels.splice(selectionMin + offset, 0, ...doc.song.channels.splice(selectionMin, selectionMax - selectionMin + 1));
            doc.notifier.changed();
            this._didSomething();
        }
    }
    class ChangeAddChannel extends ChangeGroup {
        constructor(doc, index, isNoise) {
            super();
            const newPitchChannelCount = doc.song.pitchChannelCount + (isNoise ? 0 : 1);
            const newNoiseChannelCount = doc.song.drumChannelCount + (isNoise ? 1 : 0);
            if (newPitchChannelCount <= Config.pitchChannelCountMax && newNoiseChannelCount <= Config.drumChannelCountMax) {
                const addedChannelIndex = isNoise ? doc.song.pitchChannelCount + doc.song.drumChannelCount : doc.song.pitchChannelCount;
                this.append(new ChangeChannelCount(doc, newPitchChannelCount, newNoiseChannelCount));
                this.append(new ChangeChannelOrder(doc, index, addedChannelIndex - 1, 1));
            }
            doc.notifier.changed();
            this._didSomething();
        }
    }
    class ChangeRemoveChannel extends ChangeGroup {
        constructor(doc, minIndex, maxIndex) {
            super();
            while (maxIndex >= minIndex) {
                const isNoise = doc.song.getChannelIsDrum(maxIndex);
                doc.song.channels.splice(maxIndex, 1);
                if (isNoise) {
                    doc.song.drumChannelCount--;
                }
                else {
                    doc.song.pitchChannelCount--;
                }
                maxIndex--;
            }
            if (doc.song.pitchChannelCount < Config.pitchChannelCountMin) {
                this.append(new ChangeChannelCount(doc, Config.pitchChannelCountMin, doc.song.drumChannelCount));
            }
            this.append(new ChangeChannelBar(doc, Math.max(0, minIndex - 1), doc.bar));
            this._didSomething();
            doc.notifier.changed();
        }
    }
    class ChangeChannelBar extends Change {
        constructor(doc, newChannel, newBar) {
            super();
            const oldChannel = doc.channel;
            const oldBar = doc.bar;
            doc.channel = newChannel;
            doc.bar = newBar;
            doc.barScrollPos = Math.min(doc.bar, Math.max(doc.bar - (doc.trackVisibleBars - 1), doc.barScrollPos));
            doc.notifier.changed();
            if (oldChannel != newChannel || oldBar != newBar) {
                this._didSomething();
            }
        }
    }
    class ChangeChorus extends Change {
        constructor(doc, newValue) {
            super();
            const oldValue = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].chorus;
            if (oldValue != newValue) {
                this._didSomething();
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].chorus = newValue;
                doc.notifier.changed();
            }
        }
    }
    class ChangeEffect extends Change {
        constructor(doc, newValue) {
            super();
            const oldValue = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].effect;
            if (oldValue != newValue) {
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].effect = newValue;
                doc.notifier.changed();
                this._didSomething();
            }
        }
    }
    class ChangeHarm extends Change {
        constructor(doc, newValue) {
            super();
            const oldValue = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].harm;
            if (oldValue != newValue) {
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].harm = newValue;
                doc.notifier.changed();
                this._didSomething();
            }
        }
    }
    class ChangeFMChorus extends Change {
        constructor(doc, newValue) {
            super();
            const oldValue = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].fmChorus;
            if (oldValue != newValue) {
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].fmChorus = newValue;
                doc.notifier.changed();
                this._didSomething();
            }
        }
    }
    class ChangeOctoff extends Change {
        constructor(doc, newValue) {
            super();
            const oldValue = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].octoff;
            if (oldValue != newValue) {
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].octoff = newValue;
                doc.notifier.changed();
                this._didSomething();
            }
        }
    }
    class ChangeImute extends Change {
        constructor(doc, newValue) {
            super();
            const oldValue = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].imute;
            if (oldValue != newValue) {
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].imute = newValue;
                doc.notifier.changed();
                this._didSomething();
            }
        }
    }
    class ChangeAllImute extends Change {
        constructor(doc, newValue, index) {
            super();
            const oldValue = doc.song.channels[doc.channel].instruments[index].imute;
            if (oldValue != newValue) {
                doc.song.channels[doc.channel].instruments[index].imute = newValue;
                doc.notifier.changed();
                this._didSomething();
            }
        }
    }
    class ChangeSoloChannels extends Change {
        constructor(doc, newValue, curChannel, curInstrument) {
            super();
            const oldValue = doc.song.channels[curChannel].instruments[curInstrument].imute;
            if (oldValue != newValue) {
                doc.song.channels[curChannel].instruments[curInstrument].imute = newValue;
                doc.notifier.changed();
                this._didSomething();
            }
        }
    }
    class ChangeIpan extends Change {
        constructor(doc, oldValue, newValue) {
            super();
            if (oldValue != newValue) {
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].ipan = newValue;
                doc.notifier.changed();
                this._didSomething();
            }
        }
    }
    class ChangeFilter extends Change {
        constructor(doc, newValue) {
            super();
            const oldValue = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].filter;
            if (oldValue != newValue) {
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].filter = newValue;
                doc.notifier.changed();
                this._didSomething();
            }
        }
    }
    class ChangeAlgorithm extends Change {
        constructor(doc, newValue) {
            super();
            const oldValue = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].algorithm;
            if (oldValue != newValue) {
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].algorithm = newValue;
                doc.notifier.changed();
                this._didSomething();
            }
        }
    }
    class ChangeFeedbackType extends Change {
        constructor(doc, newValue) {
            super();
            const oldValue = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].feedbackType;
            if (oldValue != newValue) {
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].feedbackType = newValue;
                doc.notifier.changed();
                this._didSomething();
            }
        }
    }
    class ChangeFeedbackEnvelope extends Change {
        constructor(doc, newValue) {
            super();
            const oldValue = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].feedbackEnvelope;
            if (oldValue != newValue) {
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].feedbackEnvelope = newValue;
                doc.notifier.changed();
                this._didSomething();
            }
        }
    }
    class ChangeOperatorEnvelope extends Change {
        constructor(doc, operatorIndex, newValue) {
            super();
            const oldValue = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].operators[operatorIndex].envelope;
            if (oldValue != newValue) {
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].operators[operatorIndex].envelope = newValue;
                doc.notifier.changed();
                this._didSomething();
            }
        }
    }
    class ChangeOperatorFrequency extends Change {
        constructor(doc, operatorIndex, newValue) {
            super();
            const oldValue = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].operators[operatorIndex].frequency;
            if (oldValue != newValue) {
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].operators[operatorIndex].frequency = newValue;
                doc.notifier.changed();
                this._didSomething();
            }
        }
    }
    class ChangeOperatorAmplitude extends Change {
        constructor(doc, operatorIndex, oldValue, newValue) {
            super();
            doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].operators[operatorIndex].amplitude = newValue;
            doc.notifier.changed();
            if (oldValue != newValue)
                this._didSomething();
        }
    }
    class ChangeFeedbackAmplitude extends Change {
        constructor(doc, oldValue, newValue) {
            super();
            doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].feedbackAmplitude = newValue;
            doc.notifier.changed();
            if (oldValue != newValue)
                this._didSomething();
        }
    }
    class ChangeInstrumentsPerChannel extends Change {
        constructor(doc, newInstrumentsPerChannel) {
            super();
            if (doc.song.instrumentsPerChannel != newInstrumentsPerChannel) {
                for (let channel = 0; channel < doc.song.getChannelCount(); channel++) {
                    const sampleInstrument = doc.song.channels[channel].instruments[doc.song.instrumentsPerChannel - 1];
                    for (let j = doc.song.instrumentsPerChannel; j < newInstrumentsPerChannel; j++) {
                        const newInstrument = new Instrument();
                        newInstrument.copy(sampleInstrument);
                        doc.song.channels[channel].instruments[j] = newInstrument;
                    }
                    doc.song.channels[channel].instruments.length = newInstrumentsPerChannel;
                    for (let j = 0; j < doc.song.patternsPerChannel; j++) {
                        if (doc.song.channels[channel].patterns[j].instrument >= newInstrumentsPerChannel) {
                            doc.song.channels[channel].patterns[j].instrument = 0;
                        }
                    }
                }
                doc.song.instrumentsPerChannel = newInstrumentsPerChannel;
                doc.notifier.changed();
                this._didSomething();
            }
        }
    }
    class ChangeKey extends Change {
        constructor(doc, newValue) {
            super();
            if (doc.song.key != newValue) {
                doc.song.key = newValue;
                doc.notifier.changed();
                this._didSomething();
            }
        }
    }
    class ChangeSongTheme extends Change {
        constructor(doc, oldValue, newValue) {
            super();
            if (newValue.length > 30) {
                newValue = newValue.substring(0, 30);
            }
            doc.song.setSongTheme = newValue;
            doc.notifier.changed();
            if (oldValue != newValue)
                this._didSomething();
        }
    }
    class ChangeLoop extends Change {
        constructor(_doc, oldStart, oldLength, newStart, newLength) {
            super();
            this._doc = _doc;
            this.oldStart = oldStart;
            this.oldLength = oldLength;
            this.newStart = newStart;
            this.newLength = newLength;
            this._doc.song.loopStart = this.newStart;
            this._doc.song.loopLength = this.newLength;
            this._doc.notifier.changed();
            if (this.oldStart != this.newStart || this.oldLength != this.newLength) {
                this._didSomething();
            }
        }
    }
    class ChangePitchAdded extends UndoableChange {
        constructor(doc, note, pitch, index, deletion = false) {
            super(deletion);
            this._doc = doc;
            this._note = note;
            this._pitch = pitch;
            this._index = index;
            this._didSomething();
            this.redo();
        }
        _doForwards() {
            this._note.pitches.splice(this._index, 0, this._pitch);
            this._doc.notifier.changed();
        }
        _doBackwards() {
            this._note.pitches.splice(this._index, 1);
            this._doc.notifier.changed();
        }
    }
    class ChangeOctave extends Change {
        constructor(doc, oldValue, newValue) {
            super();
            this.oldValue = oldValue;
            doc.song.channels[doc.channel].octave = newValue;
            doc.notifier.changed();
            if (oldValue != newValue)
                this._didSomething();
        }
    }
    class ChangePartsPerBeat extends ChangeGroup {
        constructor(doc, newValue) {
            super();
            if (doc.song.partsPerBeat != newValue) {
                for (let i = 0; i < doc.song.getChannelCount(); i++) {
                    for (let j = 0; j < doc.song.channels[i].patterns.length; j++) {
                        this.append(new ChangeRhythm(doc, doc.song.channels[i].patterns[j], doc.song.partsPerBeat, newValue));
                    }
                }
                doc.song.partsPerBeat = newValue;
                doc.notifier.changed();
                this._didSomething();
            }
        }
    }
    class ChangePaste extends ChangeGroup {
        constructor(doc, pattern, notes, newBeatsPerBar, newPartsPerBeat) {
            super();
            pattern.notes = notes;
            if (doc.song.partsPerBeat != newPartsPerBeat) {
                this.append(new ChangeRhythm(doc, pattern, newPartsPerBeat, doc.song.partsPerBeat));
            }
            if (doc.song.beatsPerBar != newBeatsPerBar) {
                this.append(new ChangeNoteTruncate(doc, pattern, doc.song.beatsPerBar * doc.song.partsPerBeat, newBeatsPerBar * doc.song.partsPerBeat));
            }
            doc.notifier.changed();
            this._didSomething();
        }
    }
    class ChangePatternInstrument extends Change {
        constructor(doc, newValue, pattern) {
            super();
            if (pattern.instrument != newValue) {
                pattern.instrument = newValue;
                doc.notifier.changed();
                this._didSomething();
            }
        }
    }
    class ChangePatternsPerChannel extends Change {
        constructor(doc, newValue) {
            super();
            if (doc.song.patternsPerChannel != newValue) {
                for (let i = 0; i < doc.song.getChannelCount(); i++) {
                    const channelBars = doc.song.channels[i].bars;
                    const channelPatterns = doc.song.channels[i].patterns;
                    for (let j = 0; j < channelBars.length; j++) {
                        if (channelBars[j] > newValue)
                            channelBars[j] = 0;
                    }
                    for (let j = channelPatterns.length; j < newValue; j++) {
                        channelPatterns[j] = new Pattern();
                    }
                    channelPatterns.length = newValue;
                }
                doc.song.patternsPerChannel = newValue;
                doc.notifier.changed();
                this._didSomething();
            }
        }
    }
    class ChangeEnsurePatternExists extends UndoableChange {
        constructor(doc) {
            super(false);
            this._patternOldNotes = null;
            const song = doc.song;
            if (song.channels[doc.channel].bars[doc.bar] != 0)
                return;
            this._doc = doc;
            this._bar = doc.bar;
            this._channel = doc.channel;
            this._oldPatternCount = song.patternsPerChannel;
            this._newPatternCount = song.patternsPerChannel;
            let firstEmptyUnusedIndex = null;
            let firstUnusedIndex = null;
            for (let patternIndex = 1; patternIndex <= song.patternsPerChannel; patternIndex++) {
                let used = false;
                for (let barIndex = 0; barIndex < song.barCount; barIndex++) {
                    if (song.channels[doc.channel].bars[barIndex] == patternIndex) {
                        used = true;
                        break;
                    }
                }
                if (used)
                    continue;
                if (firstUnusedIndex == null) {
                    firstUnusedIndex = patternIndex;
                }
                const pattern = song.channels[doc.channel].patterns[patternIndex - 1];
                if (pattern.notes.length == 0) {
                    firstEmptyUnusedIndex = patternIndex;
                    break;
                }
            }
            if (firstEmptyUnusedIndex != null) {
                this._patternIndex = firstEmptyUnusedIndex;
            }
            else if (song.patternsPerChannel < song.barCount) {
                this._newPatternCount = song.patternsPerChannel + 1;
                this._patternIndex = song.patternsPerChannel + 1;
            }
            else if (firstUnusedIndex != null) {
                this._patternIndex = firstUnusedIndex;
                this._patternOldNotes = song.channels[doc.channel].patterns[firstUnusedIndex - 1].notes;
            }
            else {
                throw new Error();
            }
            this._didSomething();
            this._doForwards();
        }
        _doForwards() {
            const song = this._doc.song;
            for (let j = song.patternsPerChannel; j < this._newPatternCount; j++) {
                for (let i = 0; i < song.getChannelCount(); i++) {
                    song.channels[i].patterns[j] = new Pattern();
                }
            }
            song.patternsPerChannel = this._newPatternCount;
            const pattern = song.channels[this._channel].patterns[this._patternIndex - 1];
            pattern.notes = [];
            song.channels[this._channel].bars[this._bar] = this._patternIndex;
            this._doc.notifier.changed();
        }
        _doBackwards() {
            const song = this._doc.song;
            const pattern = song.channels[this._channel].patterns[this._patternIndex - 1];
            if (this._patternOldNotes != null)
                pattern.notes = this._patternOldNotes;
            song.channels[this._channel].bars[this._bar] = 0;
            for (let i = 0; i < song.getChannelCount(); i++) {
                song.channels[i].patterns.length = this._oldPatternCount;
            }
            song.patternsPerChannel = this._oldPatternCount;
            this._doc.notifier.changed();
        }
    }
    class ChangePinTime extends ChangePins {
        constructor(doc, note, pinIndex, shiftedTime) {
            super(doc, note);
            shiftedTime -= this._oldStart;
            const originalTime = this._oldPins[pinIndex].time;
            const skipStart = Math.min(originalTime, shiftedTime);
            const skipEnd = Math.max(originalTime, shiftedTime);
            let setPin = false;
            for (let i = 0; i < this._oldPins.length; i++) {
                const oldPin = note.pins[i];
                const time = oldPin.time;
                if (time < skipStart) {
                    this._newPins.push(makeNotePin(oldPin.interval, time, oldPin.volume));
                }
                else if (time > skipEnd) {
                    if (!setPin) {
                        this._newPins.push(makeNotePin(this._oldPins[pinIndex].interval, shiftedTime, this._oldPins[pinIndex].volume));
                        setPin = true;
                    }
                    this._newPins.push(makeNotePin(oldPin.interval, time, oldPin.volume));
                }
            }
            if (!setPin) {
                this._newPins.push(makeNotePin(this._oldPins[pinIndex].interval, shiftedTime, this._oldPins[pinIndex].volume));
            }
            this._finishSetup();
        }
    }
    class ChangePitchBend extends ChangePins {
        constructor(doc, note, bendStart, bendEnd, bendTo, pitchIndex) {
            super(doc, note);
            bendStart -= this._oldStart;
            bendEnd -= this._oldStart;
            bendTo -= note.pitches[pitchIndex];
            let setStart = false;
            let setEnd = false;
            let prevInterval = 0;
            let prevVolume = 3;
            let persist = true;
            let i;
            let direction;
            let stop;
            let push;
            if (bendEnd > bendStart) {
                i = 0;
                direction = 1;
                stop = note.pins.length;
                push = (item) => { this._newPins.push(item); };
            }
            else {
                i = note.pins.length - 1;
                direction = -1;
                stop = -1;
                push = (item) => { this._newPins.unshift(item); };
            }
            for (; i != stop; i += direction) {
                const oldPin = note.pins[i];
                const time = oldPin.time;
                for (;;) {
                    if (!setStart) {
                        if (time * direction <= bendStart * direction) {
                            prevInterval = oldPin.interval;
                            prevVolume = oldPin.volume;
                        }
                        if (time * direction < bendStart * direction) {
                            push(makeNotePin(oldPin.interval, time, oldPin.volume));
                            break;
                        }
                        else {
                            push(makeNotePin(prevInterval, bendStart, prevVolume));
                            setStart = true;
                        }
                    }
                    else if (!setEnd) {
                        if (time * direction <= bendEnd * direction) {
                            prevInterval = oldPin.interval;
                            prevVolume = oldPin.volume;
                        }
                        if (time * direction < bendEnd * direction) {
                            break;
                        }
                        else {
                            push(makeNotePin(bendTo, bendEnd, prevVolume));
                            setEnd = true;
                        }
                    }
                    else {
                        if (time * direction == bendEnd * direction) {
                            break;
                        }
                        else {
                            if (oldPin.interval != prevInterval)
                                persist = false;
                            push(makeNotePin(persist ? bendTo : oldPin.interval, time, oldPin.volume));
                            break;
                        }
                    }
                }
            }
            if (!setEnd) {
                push(makeNotePin(bendTo, bendEnd, prevVolume));
            }
            this._finishSetup();
        }
    }
    class ChangeRhythm extends ChangeSequence {
        constructor(doc, bar, oldPartsPerBeat, newPartsPerBeat) {
            super();
            let changeRhythm;
            if (oldPartsPerBeat > newPartsPerBeat) {
                changeRhythm = (oldTime) => Math.ceil(oldTime * newPartsPerBeat / oldPartsPerBeat);
            }
            else if (oldPartsPerBeat < newPartsPerBeat) {
                changeRhythm = (oldTime) => Math.floor(oldTime * newPartsPerBeat / oldPartsPerBeat);
            }
            else {
                throw new Error("ChangeRhythm couldn't handle rhythm change from " + oldPartsPerBeat + " to " + newPartsPerBeat + ".");
            }
            let i = 0;
            while (i < bar.notes.length) {
                const note = bar.notes[i];
                if (changeRhythm(note.start) >= changeRhythm(note.end)) {
                    this.append(new ChangeNoteAdded(doc, bar, note, i, true));
                }
                else {
                    this.append(new ChangeRhythmNote(doc, note, changeRhythm));
                    i++;
                }
            }
        }
    }
    class ChangeRhythmNote extends ChangePins {
        constructor(doc, note, changeRhythm) {
            super(doc, note);
            for (const oldPin of this._oldPins) {
                this._newPins.push(makeNotePin(oldPin.interval, changeRhythm(oldPin.time + this._oldStart) - this._oldStart, oldPin.volume));
            }
            this._finishSetup();
        }
    }
    class ChangeScale extends Change {
        constructor(doc, newValue) {
            super();
            if (doc.song.scale != newValue) {
                doc.song.scale = newValue;
                doc.notifier.changed();
                this._didSomething();
            }
        }
    }
    class ChangeMix extends Change {
        constructor(doc, newValue) {
            super();
            if (doc.song.mix != newValue) {
                doc.song.mix = newValue;
                doc.notifier.changed();
                this._didSomething();
            }
        }
    }
    class ChangeSampleRate extends Change {
        constructor(doc, newValue) {
            super();
            if (doc.song.sampleRate != newValue) {
                doc.song.sampleRate = newValue;
                doc.notifier.changed();
                this._didSomething();
            }
        }
    }
    class ChangeSong extends Change {
        constructor(doc, newHash) {
            super();
            doc.song.fromBase64String(newHash);
            doc.channel = Math.min(doc.channel, doc.song.getChannelCount() - 1);
            doc.bar = Math.max(0, Math.min(doc.song.barCount - 1, doc.bar));
            doc.barScrollPos = Math.max(0, Math.min(doc.song.barCount - doc.trackVisibleBars, doc.barScrollPos));
            doc.barScrollPos = Math.min(doc.bar, Math.max(doc.bar - (doc.trackVisibleBars - 1), doc.barScrollPos));
            doc.notifier.changed();
            this._didSomething();
        }
    }
    class ChangeTempo extends Change {
        constructor(doc, oldValue, newValue) {
            super();
            doc.song.tempo = newValue;
            doc.notifier.changed();
            if (oldValue != newValue)
                this._didSomething();
        }
    }
    class ChangeReverb extends Change {
        constructor(doc, oldValue, newValue) {
            super();
            doc.song.reverb = newValue;
            doc.notifier.changed();
            if (oldValue != newValue)
                this._didSomething();
        }
    }
    class ChangeBlend extends Change {
        constructor(doc, oldValue, newValue) {
            super();
            doc.song.blend = newValue;
            doc.notifier.changed();
            if (oldValue != newValue)
                this._didSomething();
        }
    }
    class ChangeRiff extends Change {
        constructor(doc, oldValue, newValue) {
            super();
            doc.song.riff = newValue;
            doc.notifier.changed();
            if (oldValue != newValue)
                this._didSomething();
        }
    }
    class ChangeDetune extends Change {
        constructor(doc, oldValue, newValue) {
            super();
            doc.song.detune = newValue;
            doc.notifier.changed();
            if (oldValue != newValue)
                this._didSomething();
        }
    }
    class ChangeMuff extends Change {
        constructor(doc, oldValue, newValue) {
            super();
            doc.song.muff = newValue;
            doc.notifier.changed();
            if (oldValue != newValue)
                this._didSomething();
        }
    }
    class ChangeNoteAdded extends UndoableChange {
        constructor(doc, pattern, note, index, deletion = false) {
            super(deletion);
            this._doc = doc;
            this._pattern = pattern;
            this._note = note;
            this._index = index;
            this._didSomething();
            this.redo();
        }
        _doForwards() {
            this._pattern.notes.splice(this._index, 0, this._note);
            this._doc.notifier.changed();
        }
        _doBackwards() {
            this._pattern.notes.splice(this._index, 1);
            this._doc.notifier.changed();
        }
    }
    class ChangeNoteLength extends ChangePins {
        constructor(doc, note, truncStart, truncEnd) {
            super(doc, note);
            truncStart -= this._oldStart;
            truncEnd -= this._oldStart;
            let setStart = false;
            let prevVolume = this._oldPins[0].volume;
            let prevInterval = this._oldPins[0].interval;
            let pushLastPin = true;
            let i;
            for (i = 0; i < this._oldPins.length; i++) {
                const oldPin = this._oldPins[i];
                if (oldPin.time < truncStart) {
                    prevVolume = oldPin.volume;
                    prevInterval = oldPin.interval;
                }
                else if (oldPin.time <= truncEnd) {
                    if (oldPin.time > truncStart && !setStart) {
                        this._newPins.push(makeNotePin(prevInterval, truncStart, prevVolume));
                    }
                    this._newPins.push(makeNotePin(oldPin.interval, oldPin.time, oldPin.volume));
                    setStart = true;
                    if (oldPin.time == truncEnd) {
                        pushLastPin = false;
                        break;
                    }
                }
                else {
                    break;
                }
            }
            if (pushLastPin)
                this._newPins.push(makeNotePin(this._oldPins[i].interval, truncEnd, this._oldPins[i].volume));
            this._finishSetup();
        }
    }
    class ChangeNoteTruncate extends ChangeSequence {
        constructor(doc, pattern, start, end, skipNote) {
            super();
            let i = 0;
            while (i < pattern.notes.length) {
                const note = pattern.notes[i];
                if (note == skipNote && skipNote != undefined) {
                    i++;
                }
                else if (note.end <= start) {
                    i++;
                }
                else if (note.start >= end) {
                    break;
                }
                else if (note.start < start) {
                    this.append(new ChangeNoteLength(doc, note, note.start, start));
                    i++;
                }
                else if (note.end > end) {
                    this.append(new ChangeNoteLength(doc, note, end, note.end));
                    i++;
                }
                else {
                    this.append(new ChangeNoteAdded(doc, pattern, note, i, true));
                }
            }
        }
    }
    class ChangeTransposeNote extends UndoableChange {
        constructor(doc, note, upward) {
            super(false);
            this._doc = doc;
            this._note = note;
            this._oldPins = note.pins;
            this._newPins = [];
            this._oldPitches = note.pitches;
            this._newPitches = [];
            const maxPitch = (doc.song.getChannelIsDrum(doc.channel) ? Config.drumCount - 1 : Config.maxPitch);
            for (let i = 0; i < this._oldPitches.length; i++) {
                let pitch = this._oldPitches[i];
                if (upward) {
                    for (let j = pitch + 1; j <= maxPitch; j++) {
                        if (doc.song.getChannelIsDrum(doc.channel) || Config.scales[doc.song.scale].flags[j % 12]) {
                            pitch = j;
                            break;
                        }
                    }
                }
                else {
                    for (let j = pitch - 1; j >= 0; j--) {
                        if (doc.song.getChannelIsDrum(doc.channel) || Config.scales[doc.song.scale].flags[j % 12]) {
                            pitch = j;
                            break;
                        }
                    }
                }
                let foundMatch = false;
                for (let j = 0; j < this._newPitches.length; j++) {
                    if (this._newPitches[j] == pitch) {
                        foundMatch = true;
                        break;
                    }
                }
                if (!foundMatch)
                    this._newPitches.push(pitch);
            }
            let min = 0;
            let max = maxPitch;
            for (let i = 1; i < this._newPitches.length; i++) {
                const diff = this._newPitches[0] - this._newPitches[i];
                if (min < diff)
                    min = diff;
                if (max > diff + maxPitch)
                    max = diff + maxPitch;
            }
            for (const oldPin of this._oldPins) {
                let interval = oldPin.interval + this._oldPitches[0];
                if (interval < min)
                    interval = min;
                if (interval > max)
                    interval = max;
                if (upward) {
                    for (let i = interval + 1; i <= max; i++) {
                        if (doc.song.getChannelIsDrum(doc.channel) || Config.scales[doc.song.scale].flags[i % 12]) {
                            interval = i;
                            break;
                        }
                    }
                }
                else {
                    for (let i = interval - 1; i >= min; i--) {
                        if (doc.song.getChannelIsDrum(doc.channel) || Config.scales[doc.song.scale].flags[i % 12]) {
                            interval = i;
                            break;
                        }
                    }
                }
                interval -= this._newPitches[0];
                this._newPins.push(makeNotePin(interval, oldPin.time, oldPin.volume));
            }
            if (this._newPins[0].interval != 0)
                throw new Error("wrong pin start interval");
            for (let i = 1; i < this._newPins.length - 1;) {
                if (this._newPins[i - 1].interval == this._newPins[i].interval &&
                    this._newPins[i].interval == this._newPins[i + 1].interval &&
                    this._newPins[i - 1].volume == this._newPins[i].volume &&
                    this._newPins[i].volume == this._newPins[i + 1].volume) {
                    this._newPins.splice(i, 1);
                }
                else {
                    i++;
                }
            }
            this._doForwards();
            this._didSomething();
        }
        _doForwards() {
            this._note.pins = this._newPins;
            this._note.pitches = this._newPitches;
            this._doc.notifier.changed();
        }
        _doBackwards() {
            this._note.pins = this._oldPins;
            this._note.pitches = this._oldPitches;
            this._doc.notifier.changed();
        }
    }
    class ChangeTranspose extends ChangeSequence {
        constructor(doc, pattern, upward) {
            super();
            for (let i = 0; i < pattern.notes.length; i++) {
                this.append(new ChangeTransposeNote(doc, pattern.notes[i], upward));
            }
        }
    }
    class ChangeVolume extends Change {
        constructor(doc, oldValue, newValue) {
            super();
            doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].volume = newValue;
            doc.notifier.changed();
            if (oldValue != newValue)
                this._didSomething();
        }
    }
    class ChangeVolumeBend extends UndoableChange {
        constructor(doc, note, bendPart, bendVolume, bendInterval) {
            super(false);
            this._doc = doc;
            this._note = note;
            this._oldPins = note.pins;
            this._newPins = [];
            let inserted = false;
            for (const pin of note.pins) {
                if (pin.time < bendPart) {
                    this._newPins.push(pin);
                }
                else if (pin.time == bendPart) {
                    this._newPins.push(makeNotePin(bendInterval, bendPart, bendVolume));
                    inserted = true;
                }
                else {
                    if (!inserted) {
                        this._newPins.push(makeNotePin(bendInterval, bendPart, bendVolume));
                        inserted = true;
                    }
                    this._newPins.push(pin);
                }
            }
            for (let i = 1; i < this._newPins.length - 1;) {
                if (this._newPins[i - 1].interval == this._newPins[i].interval &&
                    this._newPins[i].interval == this._newPins[i + 1].interval &&
                    this._newPins[i - 1].volume == this._newPins[i].volume &&
                    this._newPins[i].volume == this._newPins[i + 1].volume) {
                    this._newPins.splice(i, 1);
                }
                else {
                    i++;
                }
            }
            this._doForwards();
            this._didSomething();
        }
        _doForwards() {
            this._note.pins = this._newPins;
            this._doc.notifier.changed();
        }
        _doBackwards() {
            this._note.pins = this._oldPins;
            this._doc.notifier.changed();
        }
    }
    class ChangeWave extends Change {
        constructor(doc, newValue) {
            super();
            if (doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].wave != newValue) {
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].wave = newValue;
                doc.notifier.changed();
                this._didSomething();
            }
        }
    }

    class ColorConfig {
        static getChannelColor(song, channel) {
            return channel < song.pitchChannelCount
                ? ColorConfig.pitchChannels[channel % ColorConfig.pitchChannels.length]
                : ColorConfig.noiseChannels[(channel - song.pitchChannelCount) % ColorConfig.noiseChannels.length];
        }
        static setTheme(theme) {
            this._styleElement.textContent = this._themeMap[theme];
            this.usesPianoScheme = (getComputedStyle(this._styleElement).getPropertyValue("--use-piano-scheme").trim() == "true");
            console.log("use-piano-scheme: " + this.usesPianoScheme);
        }
    }
    ColorConfig.colorLookup = new Map();
    ColorConfig.usesPianoScheme = false;
    ColorConfig._themeMap = {
        "default": `
            :root {
				--page-margin: black;
				--editor-background: black;
				--hover-preview: white;
				--playhead: white;
				--primary-text: white;
				--secondary-text: #999;
				--inverted-text: black;
				--text-selection: rgba(119,68,255,0.99);
				--box-selection-fill: rgba(255,255,255,0.2);
				--loop-accent: #9900cc;
				--link-accent: #98f;
				--ui-widget-background: #363636;
				--ui-widget-focus: #777;
				--pitch-background: #444;
				--tonic: #864;
				--fifth-note: #468;
                --volume-icon: #777777;
				--octave-scrollbar: #444;
				--scrollbar-octave: #864;
				--channel-box: #444;

				--pitch1-secondary-channel: #0099a1;
				--pitch1-primary-channel:   #25f3ff;
				--pitch1-secondary-note:    #0099a1;
				--pitch1-primary-note:      #25f3ff;
				--pitch2-secondary-channel: #439143;
				--pitch2-primary-channel:   #44ff44;
				--pitch2-secondary-note:    #439143;
				--pitch2-primary-note:      #44ff44;
				--pitch3-secondary-channel: #a1a100;
				--pitch3-primary-channel:   #ffff25;
				--pitch3-secondary-note:    #a1a100;
				--pitch3-primary-note:      #ffff25;
				--pitch4-secondary-channel: #c75000;
				--pitch4-primary-channel:   #ff9752;
				--pitch4-secondary-note:    #c75000;
				--pitch4-primary-note:      #ff9752;
				--pitch5-secondary-channel: #d020d0;
				--pitch5-primary-channel:   #FF90FF;
				--pitch5-secondary-note:    #d020d0;
				--pitch5-primary-note:      #ff90ff;
				--pitch6-secondary-channel: #552377;
				--pitch6-primary-channel:   #9f31ea;
				--pitch6-secondary-note:    #552377;
				--pitch6-primary-note:      #9f31ea;
				--pitch7-secondary-channel: #221b89;
				--pitch7-primary-channel:   #2b6aff;
				--pitch7-secondary-note:    #221b89;
				--pitch7-primary-note:      #2b6aff;
				--pitch8-secondary-channel: #00995f;
				--pitch8-primary-channel:   #00ff9f;
				--pitch8-secondary-note:    #00995f;
				--pitch8-primary-note:      #00ff9f;
				--pitch9-secondary-channel: #d6b03e;
				--pitch9-primary-channel:   #ffbf00;
				--pitch9-secondary-note:    #d6b03e;
				--pitch9-primary-note:      #ffbf00;
				--pitch10-secondary-channel:#b25915;
				--pitch10-primary-channel:  #d85d00;
				--pitch10-secondary-note:   #b25915;
				--pitch10-primary-note:     #d85d00;

				--pitch11-secondary-channel:#891a60;
				--pitch11-primary-channel:  #ff00a1;
				--pitch11-secondary-note:   #891a60;
				--pitch11-primary-note:     #ff00a1;

				--pitch12-secondary-channel:#965cbc;
				--pitch12-primary-channel:  #c26afc;
				--pitch12-secondary-note:   #965cbc;
				--pitch12-primary-note:     #c26afc;

				--noise1-secondary-channel: #991010;
				--noise1-primary-channel:   #ff1616;
				--noise1-secondary-note:    #991010;
				--noise1-primary-note:      #ff1616;
				--noise2-secondary-channel: #aaaaaa;
				--noise2-primary-channel:   #ffffff;
				--noise2-secondary-note:    #aaaaaa;
				--noise2-primary-note:      #ffffff;
				--noise3-secondary-channel: #5869BD;
				--noise3-primary-channel:   #768dfc;
				--noise3-secondary-note:    #5869BD;
				--noise3-primary-note:      #768dfc;
				--noise4-secondary-channel: #7c9b42;
				--noise4-primary-channel:   #a5ff00;
				--noise4-secondary-note:    #7c9b42;
				--noise4-primary-note:      #a5ff00;
            }
        `,
        "nepbox": `
            :root {
				--page-margin: black;
				--editor-background: black;
				--hover-preview: white;
				--playhead: white;
				--primary-text: #00fff5;
				--secondary-text: #999;
				--inverted-text: black;
				--text-selection: rgba(119,68,255,0.99);
				--box-selection-fill: rgba(255,255,255,0.2);
				--loop-accent: #00fff5;
				--link-accent: #98f;
				--ui-widget-background: #363636;
				--ui-widget-focus: #777;
				--pitch-background: #0a2d44;
				--tonic: #9150ff;
				--fifth-note: #990000;
                --volume-icon: #00fff5;
				--octave-scrollbar: #484848;
				--scrollbar-octave: #9150ff;
				--channel-box: #444;

				--pitch1-secondary-channel: #c13cbf;
				--pitch1-primary-channel: #f75dff;
				--pitch1-secondary-note: #b930a2;
				--pitch1-primary-note: #fca5ff;
				--pitch2-secondary-channel: #800000;
				--pitch2-primary-channel: #f00;
				--pitch2-secondary-note: #8c2121;
				--pitch2-primary-note: #ff5252;
				--pitch3-secondary-channel: #004bb3;
				--pitch3-primary-channel: #1792ff;
				--pitch3-secondary-note: #005cb3;
				--pitch3-primary-note: #00ffe9;
				--pitch4-secondary-channel: #a48800;
				--pitch4-primary-channel: #fb0;
				--pitch4-secondary-note: #9c4100;
				--pitch4-primary-note: #ffd84e;
				--pitch5-secondary-channel: #6c0000;
				--pitch5-primary-channel:   #ff3e3e;
				--pitch5-secondary-note:    #6c0000;
				--pitch5-primary-note:      #ff3e3e;
				--pitch6-secondary-channel:#d25a00;
				--pitch6-primary-channel:  #fdff00;
				--pitch6-secondary-note:   #d25a00;
				--pitch6-primary-note:     #fdff00;
				--pitch7-secondary-channel: #046000;
				--pitch7-primary-channel:   #0c79ff;
				--pitch7-secondary-note:    #046000;
				--pitch7-primary-note:      #0c79ff;
				--pitch8-secondary-channel:#3b2bae;
				--pitch8-primary-channel:  #d85d00;
				--pitch8-secondary-note:   #3b2bae;
				--pitch8-primary-note:     #d85d00;
				--pitch9-secondary-channel: #d6b03e;
				--pitch9-primary-channel:   #ffbf00;
				--pitch9-secondary-note:    #d6b03e;
				--pitch9-primary-note:      #ffbf00;
				--pitch10-secondary-channel:#b25915;
				--pitch10-primary-channel:  #d85d00;
				--pitch10-secondary-note:   #b25915;
				--pitch10-primary-note:     #d85d00;
				--pitch11-secondary-channel:#891a60;
				--pitch11-primary-channel:  #ff00a1;
				--pitch11-secondary-note:   #891a60;
				--pitch11-primary-note:     #ff00a1;
				--pitch12-secondary-channel:#965cbc;
				--pitch12-primary-channel:  #c26afc;
				--pitch12-secondary-note:   #965cbc;
				--pitch12-primary-note:     #c26afc;
				--noise1-secondary-channel: #868686;
				--noise1-primary-channel: #fff;
				--noise1-secondary-note: #868686;
				--noise1-primary-note: #fff;
				--noise2-secondary-channel: #805300;
				--noise2-primary-channel: #ff8c00;
				--noise2-secondary-note: #6a3500;
				--noise2-primary-note: #a85400;
				--noise3-secondary-channel: #5869BD;
				--noise3-primary-channel:   #768dfc;
				--noise3-secondary-note:    #5869BD;
				--noise3-primary-note:      #768dfc;
				--noise4-secondary-channel: #7c9b42;
				--noise4-primary-channel:   #a5ff00;
				--noise4-secondary-note:    #7c9b42;
				--noise4-primary-note:      #a5ff00;
            }
        `,
        "laffey": `
			:root {
				--page-margin: #000;
				--editor-background: #060606;
				--hover-preview: #fff;
				--playhead: rgb(0, 242, 255);
				--primary-text: #00fff5;
				--secondary-text: #a82f2f;
				--inverted-text: #000;
				--text-selection: rgba(98, 46, 164, .99);
				--box-selection-fill: #b74a4a;

				--loop-accent: #7744FF;

				--link-accent: #ff00e1;
				--ui-widget-background: #484848;
				--ui-widget-focus: #3e3e3e;
				--pitch-background: #444444;

				--tonic: #dbbeed;
				--pitch1-background: #1a2182; 
				--pitch2-background: #1a2182; 
				--pitch3-background: #1a2182; 
				--pitch4-background: #1a2182;
				--pitch5-background: #1a2182; 
				--pitch6-background: #1a2182; 
				--fifth-note: #6b1313;
				--pitch8-background: #1a2182; 
				--pitch9-background: #1a2182; 
				--pitch10-background: #1a2182; 
				--pitch11-background: #1a2182;
				--octave-scrollbar: #852929;
				--scrollbar-octave: #f2b3ff;

				--white-piano-key: #bababa;
				--black-piano-key: #444444;

				--noise-channel-limit: 2;
				--pitch1-secondary-channel: #c13cbf;
				--pitch1-primary-channel: #f75dff;
				--pitch1-secondary-note: #b930a2;
				--pitch1-primary-note: #fca5ff;
				--pitch2-secondary-channel: #800000;
				--pitch2-primary-channel: #f00;
				--pitch2-secondary-note: #8c2121;
				--pitch2-primary-note: #ff5252;
				--pitch3-secondary-channel: #004bb3;
				--pitch3-primary-channel: #1792ff;
				--pitch3-secondary-note: #005cb3;
				--pitch3-primary-note: #00ffe9;
				--pitch4-secondary-channel: #a48800;
				--pitch4-primary-channel: #fb0;
				--pitch4-secondary-note: #9c4100;
				--pitch4-primary-note: #ffd84e;
				--pitch5-secondary-channel: #6c0000;
				--pitch5-primary-channel:   #ff3e3e;
				--pitch5-secondary-note:    #6c0000;
				--pitch5-primary-note:      #ff3e3e;
				--pitch6-secondary-channel:#d25a00;
				--pitch6-primary-channel:  #fdff00;
				--pitch6-secondary-note:   #d25a00;
				--pitch6-primary-note:     #fdff00;
				--pitch7-secondary-channel: #046000;
				--pitch7-primary-channel:   #0c79ff;
				--pitch7-secondary-note:    #046000;
				--pitch7-primary-note:      #0c79ff;
				--pitch8-secondary-channel:#3b2bae;
				--pitch8-primary-channel:  #d85d00;
				--pitch8-secondary-note:   #3b2bae;
				--pitch8-primary-note:     #d85d00;
				--pitch9-secondary-channel: #d6b03e;
				--pitch9-primary-channel:   #ffbf00;
				--pitch9-secondary-note:    #d6b03e;
				--pitch9-primary-note:      #ffbf00;
				--pitch10-secondary-channel:#b25915;
				--pitch10-primary-channel:  #d85d00;
				--pitch10-secondary-note:   #b25915;
				--pitch10-primary-note:     #d85d00;
				--pitch11-secondary-channel:#891a60;
				--pitch11-primary-channel:  #ff00a1;
				--pitch11-secondary-note:   #891a60;
				--pitch11-primary-note:     #ff00a1;
				--pitch12-secondary-channel:#965cbc;
				--pitch12-primary-channel:  #c26afc;
				--pitch12-secondary-note:   #965cbc;
				--pitch12-primary-note:     #c26afc;
				--noise1-secondary-channel: #868686;
				--noise1-primary-channel: #fff;
				--noise1-secondary-note: #868686;
				--noise1-primary-note: #fff;
				--noise2-secondary-channel: #805300;
				--noise2-primary-channel: #ff8c00;
				--noise2-secondary-note: #6a3500;
				--noise2-primary-note: #a85400;
				--noise3-secondary-channel: #868686;
				--noise3-primary-channel: #fff;
				--noise3-secondary-note: #868686;
				--noise3-primary-note: #fff;
				--noise4-secondary-channel: #805300;
				--noise4-primary-channel: #ff8c00;
				--noise4-secondary-note: #6a3500;
				--noise4-primary-note: #a85400;
				}
			`,
        "modbox2": `
            :root {
                --page-margin: black;
				--editor-background: black;
				--hover-preview: white;
				--playhead: white;
				--primary-text: white;
				--secondary-text: #999;
				--inverted-text: black;
				--text-selection: rgba(119,68,255,0.99);
				--box-selection-fill: rgba(255,255,255,0.2);
				--loop-accent: #00ff00;
				--link-accent: #98f;
				--ui-widget-background: #363636;
				--ui-widget-focus: #777;
				--pitch-background: #444;
				--tonic: #c4ffa3;
				--fifth-note: #96fffb;
                --volume-icon: #c4ffa3;
				--octave-scrollbar: #00ff00;
				--scrollbar-octave: #fff;
				--channel-box: #444;

				--pitch1-secondary-channel: #0099a1;
				--pitch1-primary-channel:   #25f3ff;
				--pitch1-secondary-note:    #0099a1;
				--pitch1-primary-note:      #25f3ff;
				--pitch2-secondary-channel: #439143;
				--pitch2-primary-channel:   #44ff44;
				--pitch2-secondary-note:    #439143;
				--pitch2-primary-note:      #44ff44;
				--pitch3-secondary-channel: #a1a100;
				--pitch3-primary-channel:   #ffff25;
				--pitch3-secondary-note:    #a1a100;
				--pitch3-primary-note:      #ffff25;
				--pitch4-secondary-channel: #c75000;
				--pitch4-primary-channel:   #ff9752;
				--pitch4-secondary-note:    #c75000;
				--pitch4-primary-note:      #ff9752;
				--pitch5-secondary-channel: #d020d0;
				--pitch5-primary-channel:   #FF90FF;
				--pitch5-secondary-note:    #d020d0;
				--pitch5-primary-note:      #ff90ff;
				--pitch6-secondary-channel: #552377;
				--pitch6-primary-channel:   #9f31ea;
				--pitch6-secondary-note:    #552377;
				--pitch6-primary-note:      #9f31ea;
				--pitch7-secondary-channel: #221b89;
				--pitch7-primary-channel:   #2b6aff;
				--pitch7-secondary-note:    #221b89;
				--pitch7-primary-note:      #2b6aff;
				--pitch8-secondary-channel: #00995f;
				--pitch8-primary-channel:   #00ff9f;
				--pitch8-secondary-note:    #00995f;
				--pitch8-primary-note:      #00ff9f;
				--pitch9-secondary-channel: #d6b03e;
				--pitch9-primary-channel:   #ffbf00;
				--pitch9-secondary-note:    #d6b03e;
				--pitch9-primary-note:      #ffbf00;
				--pitch10-secondary-channel:#b25915;
				--pitch10-primary-channel:  #d85d00;
				--pitch10-secondary-note:   #b25915;
				--pitch10-primary-note:     #d85d00;

				--pitch11-secondary-channel:#891a60;
				--pitch11-primary-channel:  #ff00a1;
				--pitch11-secondary-note:   #891a60;
				--pitch11-primary-note:     #ff00a1;

				--pitch12-secondary-channel:#965cbc;
				--pitch12-primary-channel:  #c26afc;
				--pitch12-secondary-note:   #965cbc;
				--pitch12-primary-note:     #c26afc;

				--noise1-secondary-channel: #991010;
				--noise1-primary-channel:   #ff1616;
				--noise1-secondary-note:    #991010;
				--noise1-primary-note:      #ff1616;
				--noise2-secondary-channel: #aaaaaa;
				--noise2-primary-channel:   #ffffff;
				--noise2-secondary-note:    #aaaaaa;
				--noise2-primary-note:      #ffffff;
				--noise3-secondary-channel: #5869BD;
				--noise3-primary-channel:   #768dfc;
				--noise3-secondary-note:    #5869BD;
				--noise3-primary-note:      #768dfc;
				--noise4-secondary-channel: #7c9b42;
				--noise4-primary-channel:   #a5ff00;
				--noise4-secondary-note:    #7c9b42;
				--noise4-primary-note:      #a5ff00;
            }
		`,
        "artic": `
		:root {
				--page-margin: black;
				--editor-background: black;
				--hover-preview: white;
				--playhead: white;
				--primary-text: white;
				--secondary-text: #999;
				--inverted-text: black;
				--text-selection: rgba(119,68,255,0.99);
				--box-selection-fill: rgba(255,255,255,0.2);
				--loop-accent: #ffffff;
				--link-accent: #98f;
				--ui-widget-background: #363636;
				--ui-widget-focus: #777;
				--pitch-background: #444;
				--tonic: #eafffe;
				--fifth-note: #b7f1ff;
				--octave-scrollbar: #a5eeff;
				--scrollbar-octave: #cefffd;
				--volume-icon: #42dcff;	

				--pitch1-secondary-channel: #0099a1;
				--pitch1-primary-channel:   #25f3ff;
				--pitch1-secondary-note:    #0099a1;
				--pitch1-primary-note:      #25f3ff;
				--pitch2-secondary-channel: #439143;
				--pitch2-primary-channel:   #44ff44;
				--pitch2-secondary-note:    #439143;
				--pitch2-primary-note:      #44ff44;
				--pitch3-secondary-channel: #a1a100;
				--pitch3-primary-channel:   #ffff25;
				--pitch3-secondary-note:    #a1a100;
				--pitch3-primary-note:      #ffff25;
				--pitch4-secondary-channel: #c75000;
				--pitch4-primary-channel:   #ff9752;
				--pitch4-secondary-note:    #c75000;
				--pitch4-primary-note:      #ff9752;
				--pitch5-secondary-channel: #d020d0;
				--pitch5-primary-channel:   #FF90FF;
				--pitch5-secondary-note:    #d020d0;
				--pitch5-primary-note:      #ff90ff;
				--pitch6-secondary-channel: #552377;
				--pitch6-primary-channel:   #9f31ea;
				--pitch6-secondary-note:    #552377;
				--pitch6-primary-note:      #9f31ea;
				--pitch7-secondary-channel: #221b89;
				--pitch7-primary-channel:   #2b6aff;
				--pitch7-secondary-note:    #221b89;
				--pitch7-primary-note:      #2b6aff;
				--pitch8-secondary-channel: #00995f;
				--pitch8-primary-channel:   #00ff9f;
				--pitch8-secondary-note:    #00995f;
				--pitch8-primary-note:      #00ff9f;
				--pitch9-secondary-channel: #d6b03e;
				--pitch9-primary-channel:   #ffbf00;
				--pitch9-secondary-note:    #d6b03e;
				--pitch9-primary-note:      #ffbf00;
				--pitch10-secondary-channel:#b25915;
				--pitch10-primary-channel:  #d85d00;
				--pitch10-secondary-note:   #b25915;
				--pitch10-primary-note:     #d85d00;
				--pitch11-secondary-channel:#891a60;
				--pitch11-primary-channel:  #ff00a1;
				--pitch11-secondary-note:   #891a60;
				--pitch11-primary-note:     #ff00a1;
				--pitch12-secondary-channel:#965cbc;
				--pitch12-primary-channel:  #c26afc;
				--pitch12-secondary-note:   #965cbc;
				--pitch12-primary-note:     #c26afc;
				--noise1-secondary-channel: #991010;
				--noise1-primary-channel:   #ff1616;
				--noise1-secondary-note:    #991010;
				--noise1-primary-note:      #ff1616;
				--noise2-secondary-channel: #aaaaaa;
				--noise2-primary-channel:   #ffffff;
				--noise2-secondary-note:    #aaaaaa;
				--noise2-primary-note:      #ffffff;
				--noise3-secondary-channel: #5869BD;
				--noise3-primary-channel:   #768dfc;
				--noise3-secondary-note:    #5869BD;
				--noise3-primary-note:      #768dfc;
				--noise4-secondary-channel: #7c9b42;
				--noise4-primary-channel:   #a5ff00;
				--noise4-secondary-note:    #7c9b42;
				--noise4-primary-note:      #a5ff00;
				}
		`,
        "Cinnamon Roll": `
		:root {
				--page-margin: black;
				--editor-background: black;
				--hover-preview: white;
				--playhead: white;
				--primary-text: white;
				--secondary-text: #999;
				--inverted-text: black;
				--text-selection: rgba(119,68,255,0.99);
				--box-selection-fill: rgba(255,255,255,0.2);
				--loop-accent: #ba8418;
				--link-accent: #98f;
				--ui-widget-background: #363636;
				--ui-widget-focus: #777;
				--pitch-background: #444;
				--pitch1-background: #f5bb00;
				--pitch2-background: #f5bb00;
				--pitch3-background: #f5bb00;
				--pitch4-background: #f5bb00;
				--pitch5-background: #f5bb00;
				--pitch6-background: #f5bb00;
				--pitch8-background: #f5bb00;
				--pitch9-background: #f5bb00;
				--pitch10-background: #f5bb00;
				--pitch11-background: #f5bb00;
				--pitch12-background: #f5bb00;
				--tonic: #f5bb00;
				--fifth-note: #f5bb00;
				--volume-icon: #ba8418;	

				--octave-scrollbar: #e59900;
				--scrollbar-octave: #ffff25;

				--pitch1-secondary-channel: #0099a1;
				--pitch1-primary-channel:   #25f3ff;
				--pitch1-secondary-note:    #0099a1;
				--pitch1-primary-note:      #25f3ff;
				--pitch2-secondary-channel: #439143;
				--pitch2-primary-channel:   #44ff44;
				--pitch2-secondary-note:    #439143;
				--pitch2-primary-note:      #44ff44;
				--pitch3-secondary-channel: #a1a100;
				--pitch3-primary-channel:   #ffff25;
				--pitch3-secondary-note:    #a1a100;
				--pitch3-primary-note:      #ffff25;
				--pitch4-secondary-channel: #c75000;
				--pitch4-primary-channel:   #ff9752;
				--pitch4-secondary-note:    #c75000;
				--pitch4-primary-note:      #ff9752;
				--pitch5-secondary-channel: #d020d0;
				--pitch5-primary-channel:   #FF90FF;
				--pitch5-secondary-note:    #d020d0;
				--pitch5-primary-note:      #ff90ff;
				--pitch6-secondary-channel: #552377;
				--pitch6-primary-channel:   #9f31ea;
				--pitch6-secondary-note:    #552377;
				--pitch6-primary-note:      #9f31ea;
				--pitch7-secondary-channel: #221b89;
				--pitch7-primary-channel:   #2b6aff;
				--pitch7-secondary-note:    #221b89;
				--pitch7-primary-note:      #2b6aff;
				--pitch8-secondary-channel: #00995f;
				--pitch8-primary-channel:   #00ff9f;
				--pitch8-secondary-note:    #00995f;
				--pitch8-primary-note:      #00ff9f;
				--pitch9-secondary-channel: #d6b03e;
				--pitch9-primary-channel:   #ffbf00;
				--pitch9-secondary-note:    #d6b03e;
				--pitch9-primary-note:      #ffbf00;
				--pitch10-secondary-channel:#b25915;
				--pitch10-primary-channel:  #d85d00;
				--pitch10-secondary-note:   #b25915;
				--pitch10-primary-note:     #d85d00;
				--pitch11-secondary-channel:#891a60;
				--pitch11-primary-channel:  #ff00a1;
				--pitch11-secondary-note:   #891a60;
				--pitch11-primary-note:     #ff00a1;
				--pitch12-secondary-channel:#965cbc;
				--pitch12-primary-channel:  #c26afc;
				--pitch12-secondary-note:   #965cbc;
				--pitch12-primary-note:     #c26afc;
				--noise1-secondary-channel: #991010;
				--noise1-primary-channel:   #ff1616;
				--noise1-secondary-note:    #991010;
				--noise1-primary-note:      #ff1616;
				--noise2-secondary-channel: #aaaaaa;
				--noise2-primary-channel:   #ffffff;
				--noise2-secondary-note:    #aaaaaa;
				--noise2-primary-note:      #ffffff;
				--noise3-secondary-channel: #5869BD;
				--noise3-primary-channel:   #768dfc;
				--noise3-secondary-note:    #5869BD;
				--noise3-primary-note:      #768dfc;
				--noise4-secondary-channel: #7c9b42;
				--noise4-primary-channel:   #a5ff00;
				--noise4-secondary-note:    #7c9b42;
				--noise4-primary-note:      #a5ff00;
				}
		`,
        "Ocean": `
		:root {
				--page-margin: black;
				--editor-background: black;
				--hover-preview: white;
				--playhead: white;
				--primary-text: white;
				--secondary-text: #999;
				--inverted-text: black;
				--text-selection: rgba(119,68,255,0.99);
				--box-selection-fill: rgba(255,255,255,0.2);
				--loop-accent: #5982ff;
				--link-accent: #98f;
				--ui-widget-background: #363636;
				--ui-widget-focus: #777;
				--pitch-background: #444;
				--tonic: #090b3a;
				--fifth-note: #3f669b;
				--volume-icon: #090b3a;	

				--octave-scrollbar: #4449a3;
				--scrollbar-octave: #3dffdb;

				--pitch1-secondary-channel: #0099a1;
				--pitch1-primary-channel:   #25f3ff;
				--pitch1-secondary-note:    #0099a1;
				--pitch1-primary-note:      #25f3ff;
				--pitch2-secondary-channel: #439143;
				--pitch2-primary-channel:   #44ff44;
				--pitch2-secondary-note:    #439143;
				--pitch2-primary-note:      #44ff44;
				--pitch3-secondary-channel: #a1a100;
				--pitch3-primary-channel:   #ffff25;
				--pitch3-secondary-note:    #a1a100;
				--pitch3-primary-note:      #ffff25;
				--pitch4-secondary-channel: #c75000;
				--pitch4-primary-channel:   #ff9752;
				--pitch4-secondary-note:    #c75000;
				--pitch4-primary-note:      #ff9752;
				--pitch5-secondary-channel: #d020d0;
				--pitch5-primary-channel:   #FF90FF;
				--pitch5-secondary-note:    #d020d0;
				--pitch5-primary-note:      #ff90ff;
				--pitch6-secondary-channel: #552377;
				--pitch6-primary-channel:   #9f31ea;
				--pitch6-secondary-note:    #552377;
				--pitch6-primary-note:      #9f31ea;
				--pitch7-secondary-channel: #221b89;
				--pitch7-primary-channel:   #2b6aff;
				--pitch7-secondary-note:    #221b89;
				--pitch7-primary-note:      #2b6aff;
				--pitch8-secondary-channel: #00995f;
				--pitch8-primary-channel:   #00ff9f;
				--pitch8-secondary-note:    #00995f;
				--pitch8-primary-note:      #00ff9f;
				--pitch9-secondary-channel: #d6b03e;
				--pitch9-primary-channel:   #ffbf00;
				--pitch9-secondary-note:    #d6b03e;
				--pitch9-primary-note:      #ffbf00;
				--pitch10-secondary-channel:#b25915;
				--pitch10-primary-channel:  #d85d00;
				--pitch10-secondary-note:   #b25915;
				--pitch10-primary-note:     #d85d00;
				--pitch11-secondary-channel:#891a60;
				--pitch11-primary-channel:  #ff00a1;
				--pitch11-secondary-note:   #891a60;
				--pitch11-primary-note:     #ff00a1;
				--pitch12-secondary-channel:#965cbc;
				--pitch12-primary-channel:  #c26afc;
				--pitch12-secondary-note:   #965cbc;
				--pitch12-primary-note:     #c26afc;
				--noise1-secondary-channel: #991010;
				--noise1-primary-channel:   #ff1616;
				--noise1-secondary-note:    #991010;
				--noise1-primary-note:      #ff1616;
				--noise2-secondary-channel: #aaaaaa;
				--noise2-primary-channel:   #ffffff;
				--noise2-secondary-note:    #aaaaaa;
				--noise2-primary-note:      #ffffff;
				--noise3-secondary-channel: #5869BD;
				--noise3-primary-channel:   #768dfc;
				--noise3-secondary-note:    #5869BD;
				--noise3-primary-note:      #768dfc;
				--noise4-secondary-channel: #7c9b42;
				--noise4-primary-channel:   #a5ff00;
				--noise4-secondary-note:    #7c9b42;
				--noise4-primary-note:      #a5ff00;
				}
		`,
        "rainbow": `
		:root {
				--page-margin: black;
				--editor-background: black;
				--hover-preview: white;
				--playhead: white;
				--primary-text: white;
				--secondary-text: #999;
				--inverted-text: black;
				--text-selection: rgba(119,68,255,0.99);
				--box-selection-fill: rgba(255,255,255,0.2);
				--loop-accent: #ff0000;
				--link-accent: #98f;
				--ui-widget-background: #363636;
				--ui-widget-focus: #777;

				--pitch-background: #444; 
				--tonic: #ffaaaa; 
				--pitch1-background: #ffceaa; 
				--pitch2-background: #ffdfaa; 
				--pitch3-background: #fff5aa; 
				--pitch4-background: #e8ffaa;
				--pitch5-background: #bfffb2; 
				--pitch6-background: #b2ffc8; 
				--fifth-note: #b2ffe4; 
				--pitch8-background: #b2f3ff; 
				--pitch9-background: #b2b3ff; 
				--pitch10-background: #e0b2ff; 
				--pitch11-background: #ffafe9; 
				--octave-scrollbar: #43ff00; 
				--volume-icon: #ff00cb;	

				--octave-scrollbar: #43ff00;
				--scrollbar-octave: #0400ff;

				--pitch1-secondary-channel: #0099a1;
				--pitch1-primary-channel:   #25f3ff;
				--pitch1-secondary-note:    #0099a1;
				--pitch1-primary-note:      #25f3ff;
				--pitch2-secondary-channel: #439143;
				--pitch2-primary-channel:   #44ff44;
				--pitch2-secondary-note:    #439143;
				--pitch2-primary-note:      #44ff44;
				--pitch3-secondary-channel: #a1a100;
				--pitch3-primary-channel:   #ffff25;
				--pitch3-secondary-note:    #a1a100;
				--pitch3-primary-note:      #ffff25;
				--pitch4-secondary-channel: #c75000;
				--pitch4-primary-channel:   #ff9752;
				--pitch4-secondary-note:    #c75000;
				--pitch4-primary-note:      #ff9752;
				--pitch5-secondary-channel: #d020d0;
				--pitch5-primary-channel:   #FF90FF;
				--pitch5-secondary-note:    #d020d0;
				--pitch5-primary-note:      #ff90ff;
				--pitch6-secondary-channel: #552377;
				--pitch6-primary-channel:   #9f31ea;
				--pitch6-secondary-note:    #552377;
				--pitch6-primary-note:      #9f31ea;
				--pitch7-secondary-channel: #221b89;
				--pitch7-primary-channel:   #2b6aff;
				--pitch7-secondary-note:    #221b89;
				--pitch7-primary-note:      #2b6aff;
				--pitch8-secondary-channel: #00995f;
				--pitch8-primary-channel:   #00ff9f;
				--pitch8-secondary-note:    #00995f;
				--pitch8-primary-note:      #00ff9f;
				--pitch9-secondary-channel: #d6b03e;
				--pitch9-primary-channel:   #ffbf00;
				--pitch9-secondary-note:    #d6b03e;
				--pitch9-primary-note:      #ffbf00;
				--pitch10-secondary-channel:#b25915;
				--pitch10-primary-channel:  #d85d00;
				--pitch10-secondary-note:   #b25915;
				--pitch10-primary-note:     #d85d00;
				--pitch11-secondary-channel:#891a60;
				--pitch11-primary-channel:  #ff00a1;
				--pitch11-secondary-note:   #891a60;
				--pitch11-primary-note:     #ff00a1;
				--pitch12-secondary-channel:#965cbc;
				--pitch12-primary-channel:  #c26afc;
				--pitch12-secondary-note:   #965cbc;
				--pitch12-primary-note:     #c26afc;
				--noise1-secondary-channel: #991010;
				--noise1-primary-channel:   #ff1616;
				--noise1-secondary-note:    #991010;
				--noise1-primary-note:      #ff1616;
				--noise2-secondary-channel: #aaaaaa;
				--noise2-primary-channel:   #ffffff;
				--noise2-secondary-note:    #aaaaaa;
				--noise2-primary-note:      #ffffff;
				--noise3-secondary-channel: #5869BD;
				--noise3-primary-channel:   #768dfc;
				--noise3-secondary-note:    #5869BD;
				--noise3-primary-note:      #768dfc;
				--noise4-secondary-channel: #7c9b42;
				--noise4-primary-channel:   #a5ff00;
				--noise4-secondary-note:    #7c9b42;
				--noise4-primary-note:      #a5ff00;
				}
		`,
        "float": `
		:root {
				--page-margin: black;
				--editor-background: black;
				--hover-preview: white;
				--playhead: white;
				--primary-text: white;
				--secondary-text: #999;
				--inverted-text: black;
				--text-selection: rgba(119,68,255,0.99);
				--box-selection-fill: rgba(255,255,255,0.2);
				--loop-accent: #ff0000;
				--link-accent: #98f;
				--ui-widget-background: #363636;
				--ui-widget-focus: #777;
				--volume-icon: #878787;	

				--pitch-background: #444; 
				--tonic: #ffffff; 
				--pitch1-background: #ededed;  
				--pitch2-background: #cecece;  
				--pitch3-background: #bababa;  
				--pitch4-background: #afafaf;
				--pitch5-background: #a5a5a5; 
				--pitch6-background: #999999; 
				--fifth-note: #8e8e8e; 
				--pitch8-background: #828282; 
				--pitch9-background: #777777; 
				--pitch10-background: #565656; 
				--pitch11-background: #282828; 
				--octave-scrollbar: #ffffff; 
				--scrollbar-octave: #c9c9c9;

				--pitch1-secondary-channel: #0099a1;
				--pitch1-primary-channel:   #25f3ff;
				--pitch1-secondary-note:    #0099a1;
				--pitch1-primary-note:      #25f3ff;
				--pitch2-secondary-channel: #439143;
				--pitch2-primary-channel:   #44ff44;
				--pitch2-secondary-note:    #439143;
				--pitch2-primary-note:      #44ff44;
				--pitch3-secondary-channel: #a1a100;
				--pitch3-primary-channel:   #ffff25;
				--pitch3-secondary-note:    #a1a100;
				--pitch3-primary-note:      #ffff25;
				--pitch4-secondary-channel: #c75000;
				--pitch4-primary-channel:   #ff9752;
				--pitch4-secondary-note:    #c75000;
				--pitch4-primary-note:      #ff9752;
				--pitch5-secondary-channel: #d020d0;
				--pitch5-primary-channel:   #FF90FF;
				--pitch5-secondary-note:    #d020d0;
				--pitch5-primary-note:      #ff90ff;
				--pitch6-secondary-channel: #552377;
				--pitch6-primary-channel:   #9f31ea;
				--pitch6-secondary-note:    #552377;
				--pitch6-primary-note:      #9f31ea;
				--pitch7-secondary-channel: #221b89;
				--pitch7-primary-channel:   #2b6aff;
				--pitch7-secondary-note:    #221b89;
				--pitch7-primary-note:      #2b6aff;
				--pitch8-secondary-channel: #00995f;
				--pitch8-primary-channel:   #00ff9f;
				--pitch8-secondary-note:    #00995f;
				--pitch8-primary-note:      #00ff9f;
				--pitch9-secondary-channel: #d6b03e;
				--pitch9-primary-channel:   #ffbf00;
				--pitch9-secondary-note:    #d6b03e;
				--pitch9-primary-note:      #ffbf00;
				--pitch10-secondary-channel:#b25915;
				--pitch10-primary-channel:  #d85d00;
				--pitch10-secondary-note:   #b25915;
				--pitch10-primary-note:     #d85d00;
				--pitch11-secondary-channel:#891a60;
				--pitch11-primary-channel:  #ff00a1;
				--pitch11-secondary-note:   #891a60;
				--pitch11-primary-note:     #ff00a1;
				--pitch12-secondary-channel:#965cbc;
				--pitch12-primary-channel:  #c26afc;
				--pitch12-secondary-note:   #965cbc;
				--pitch12-primary-note:     #c26afc;
				--noise1-secondary-channel: #991010;
				--noise1-primary-channel:   #ff1616;
				--noise1-secondary-note:    #991010;
				--noise1-primary-note:      #ff1616;
				--noise2-secondary-channel: #aaaaaa;
				--noise2-primary-channel:   #ffffff;
				--noise2-secondary-note:    #aaaaaa;
				--noise2-primary-note:      #ffffff;
				--noise3-secondary-channel: #5869BD;
				--noise3-primary-channel:   #768dfc;
				--noise3-secondary-note:    #5869BD;
				--noise3-primary-note:      #768dfc;
				--noise4-secondary-channel: #7c9b42;
				--noise4-primary-channel:   #a5ff00;
				--noise4-secondary-note:    #7c9b42;
				--noise4-primary-note:      #a5ff00;
				}
		`,
        "windows": `
		:root {
				--page-margin: black;
				--editor-background: black;
				--hover-preview: white;
				--playhead: white;
				--primary-text: white;
				--secondary-text: #999;
				--inverted-text: black;
				--text-selection: rgba(119,68,255,0.99);
				--box-selection-fill: rgba(255,255,255,0.2);
				--loop-accent: #ff0000;
				--link-accent: #98f;
				--ui-widget-background: #363636;
				--ui-widget-focus: #777;
				--volume-icon: #15a0db;	

				--tonic: #da4e2a;
				--fifth-note: #5d9511;
				--pitch-background: #444;

				--octave-scrollbar: #295294; 
				--scrollbar-octave: #fdd01d;

				--pitch1-secondary-channel: #0099a1;
				--pitch1-primary-channel:   #25f3ff;
				--pitch1-secondary-note:    #0099a1;
				--pitch1-primary-note:      #25f3ff;
				--pitch2-secondary-channel: #439143;
				--pitch2-primary-channel:   #44ff44;
				--pitch2-secondary-note:    #439143;
				--pitch2-primary-note:      #44ff44;
				--pitch3-secondary-channel: #a1a100;
				--pitch3-primary-channel:   #ffff25;
				--pitch3-secondary-note:    #a1a100;
				--pitch3-primary-note:      #ffff25;
				--pitch4-secondary-channel: #c75000;
				--pitch4-primary-channel:   #ff9752;
				--pitch4-secondary-note:    #c75000;
				--pitch4-primary-note:      #ff9752;
				--pitch5-secondary-channel: #d020d0;
				--pitch5-primary-channel:   #FF90FF;
				--pitch5-secondary-note:    #d020d0;
				--pitch5-primary-note:      #ff90ff;
				--pitch6-secondary-channel: #552377;
				--pitch6-primary-channel:   #9f31ea;
				--pitch6-secondary-note:    #552377;
				--pitch6-primary-note:      #9f31ea;
				--pitch7-secondary-channel: #221b89;
				--pitch7-primary-channel:   #2b6aff;
				--pitch7-secondary-note:    #221b89;
				--pitch7-primary-note:      #2b6aff;
				--pitch8-secondary-channel: #00995f;
				--pitch8-primary-channel:   #00ff9f;
				--pitch8-secondary-note:    #00995f;
				--pitch8-primary-note:      #00ff9f;
				--pitch9-secondary-channel: #d6b03e;
				--pitch9-primary-channel:   #ffbf00;
				--pitch9-secondary-note:    #d6b03e;
				--pitch9-primary-note:      #ffbf00;
				--pitch10-secondary-channel:#b25915;
				--pitch10-primary-channel:  #d85d00;
				--pitch10-secondary-note:   #b25915;
				--pitch10-primary-note:     #d85d00;
				--pitch11-secondary-channel:#891a60;
				--pitch11-primary-channel:  #ff00a1;
				--pitch11-secondary-note:   #891a60;
				--pitch11-primary-note:     #ff00a1;
				--pitch12-secondary-channel:#965cbc;
				--pitch12-primary-channel:  #c26afc;
				--pitch12-secondary-note:   #965cbc;
				--pitch12-primary-note:     #c26afc;
				--noise1-secondary-channel: #991010;
				--noise1-primary-channel:   #ff1616;
				--noise1-secondary-note:    #991010;
				--noise1-primary-note:      #ff1616;
				--noise2-secondary-channel: #aaaaaa;
				--noise2-primary-channel:   #ffffff;
				--noise2-secondary-note:    #aaaaaa;
				--noise2-primary-note:      #ffffff;
				--noise3-secondary-channel: #5869BD;
				--noise3-primary-channel:   #768dfc;
				--noise3-secondary-note:    #5869BD;
				--noise3-primary-note:      #768dfc;
				--noise4-secondary-channel: #7c9b42;
				--noise4-primary-channel:   #a5ff00;
				--noise4-secondary-note:    #7c9b42;
				--noise4-primary-note:      #a5ff00;
				}
		`,
        "grassland": `
		:root {
				--page-margin: black;
				--editor-background: black;
				--hover-preview: white;
				--playhead: white;
				--primary-text: white;
				--secondary-text: #999;
				--inverted-text: black;
				--text-selection: rgba(119,68,255,0.99);
				--box-selection-fill: rgba(255,255,255,0.2);
				--loop-accent: #a0d168;
				--link-accent: #98f;
				--ui-widget-background: #363636;
				--ui-widget-focus: #777;
				--volume-icon: #74bc21;	

				--tonic: #20330a;
				--fifth-note: #74bc21;
				--pitch-background: #444;

				--octave-scrollbar: #74bc21; 
				--scrollbar-octave: #20330a;

				--pitch1-secondary-channel: #0099a1;
				--pitch1-primary-channel:   #25f3ff;
				--pitch1-secondary-note:    #0099a1;
				--pitch1-primary-note:      #25f3ff;
				--pitch2-secondary-channel: #439143;
				--pitch2-primary-channel:   #44ff44;
				--pitch2-secondary-note:    #439143;
				--pitch2-primary-note:      #44ff44;
				--pitch3-secondary-channel: #a1a100;
				--pitch3-primary-channel:   #ffff25;
				--pitch3-secondary-note:    #a1a100;
				--pitch3-primary-note:      #ffff25;
				--pitch4-secondary-channel: #c75000;
				--pitch4-primary-channel:   #ff9752;
				--pitch4-secondary-note:    #c75000;
				--pitch4-primary-note:      #ff9752;
				--pitch5-secondary-channel: #d020d0;
				--pitch5-primary-channel:   #FF90FF;
				--pitch5-secondary-note:    #d020d0;
				--pitch5-primary-note:      #ff90ff;
				--pitch6-secondary-channel: #552377;
				--pitch6-primary-channel:   #9f31ea;
				--pitch6-secondary-note:    #552377;
				--pitch6-primary-note:      #9f31ea;
				--pitch7-secondary-channel: #221b89;
				--pitch7-primary-channel:   #2b6aff;
				--pitch7-secondary-note:    #221b89;
				--pitch7-primary-note:      #2b6aff;
				--pitch8-secondary-channel: #00995f;
				--pitch8-primary-channel:   #00ff9f;
				--pitch8-secondary-note:    #00995f;
				--pitch8-primary-note:      #00ff9f;
				--pitch9-secondary-channel: #d6b03e;
				--pitch9-primary-channel:   #ffbf00;
				--pitch9-secondary-note:    #d6b03e;
				--pitch9-primary-note:      #ffbf00;
				--pitch10-secondary-channel:#b25915;
				--pitch10-primary-channel:  #d85d00;
				--pitch10-secondary-note:   #b25915;
				--pitch10-primary-note:     #d85d00;
				--pitch11-secondary-channel:#891a60;
				--pitch11-primary-channel:  #ff00a1;
				--pitch11-secondary-note:   #891a60;
				--pitch11-primary-note:     #ff00a1;
				--pitch12-secondary-channel:#965cbc;
				--pitch12-primary-channel:  #c26afc;
				--pitch12-secondary-note:   #965cbc;
				--pitch12-primary-note:     #c26afc;
				--noise1-secondary-channel: #991010;
				--noise1-primary-channel:   #ff1616;
				--noise1-secondary-note:    #991010;
				--noise1-primary-note:      #ff1616;
				--noise2-secondary-channel: #aaaaaa;
				--noise2-primary-channel:   #ffffff;
				--noise2-secondary-note:    #aaaaaa;
				--noise2-primary-note:      #ffffff;
				--noise3-secondary-channel: #5869BD;
				--noise3-primary-channel:   #768dfc;
				--noise3-secondary-note:    #5869BD;
				--noise3-primary-note:      #768dfc;
				--noise4-secondary-channel: #7c9b42;
				--noise4-primary-channel:   #a5ff00;
				--noise4-secondary-note:    #7c9b42;
				--noise4-primary-note:      #a5ff00;
				}
		`,
        "dessert": `
		:root {
				--page-margin: black;
				--editor-background: black;
				--hover-preview: white;
				--playhead: white;
				--primary-text: white;
				--secondary-text: #999;
				--inverted-text: black;
				--text-selection: rgba(119,68,255,0.99);
				--box-selection-fill: rgba(255,255,255,0.2);
				--loop-accent: #ff6254;
				--link-accent: #98f;
				--ui-widget-background: #363636;
				--ui-widget-focus: #777;
				--volume-icon: #ff0000;	

				--tonic: #fffc5b;
				--fifth-note: #ff5e3a;
				--pitch-background: #444;

				--octave-scrollbar: #ff5e3a; 
				--scrollbar-octave: #fffc5b;

				--pitch1-secondary-channel: #0099a1;
				--pitch1-primary-channel:   #25f3ff;
				--pitch1-secondary-note:    #0099a1;
				--pitch1-primary-note:      #25f3ff;
				--pitch2-secondary-channel: #439143;
				--pitch2-primary-channel:   #44ff44;
				--pitch2-secondary-note:    #439143;
				--pitch2-primary-note:      #44ff44;
				--pitch3-secondary-channel: #a1a100;
				--pitch3-primary-channel:   #ffff25;
				--pitch3-secondary-note:    #a1a100;
				--pitch3-primary-note:      #ffff25;
				--pitch4-secondary-channel: #c75000;
				--pitch4-primary-channel:   #ff9752;
				--pitch4-secondary-note:    #c75000;
				--pitch4-primary-note:      #ff9752;
				--pitch5-secondary-channel: #d020d0;
				--pitch5-primary-channel:   #FF90FF;
				--pitch5-secondary-note:    #d020d0;
				--pitch5-primary-note:      #ff90ff;
				--pitch6-secondary-channel: #552377;
				--pitch6-primary-channel:   #9f31ea;
				--pitch6-secondary-note:    #552377;
				--pitch6-primary-note:      #9f31ea;
				--pitch7-secondary-channel: #221b89;
				--pitch7-primary-channel:   #2b6aff;
				--pitch7-secondary-note:    #221b89;
				--pitch7-primary-note:      #2b6aff;
				--pitch8-secondary-channel: #00995f;
				--pitch8-primary-channel:   #00ff9f;
				--pitch8-secondary-note:    #00995f;
				--pitch8-primary-note:      #00ff9f;
				--pitch9-secondary-channel: #d6b03e;
				--pitch9-primary-channel:   #ffbf00;
				--pitch9-secondary-note:    #d6b03e;
				--pitch9-primary-note:      #ffbf00;
				--pitch10-secondary-channel:#b25915;
				--pitch10-primary-channel:  #d85d00;
				--pitch10-secondary-note:   #b25915;
				--pitch10-primary-note:     #d85d00;
				--pitch11-secondary-channel:#891a60;
				--pitch11-primary-channel:  #ff00a1;
				--pitch11-secondary-note:   #891a60;
				--pitch11-primary-note:     #ff00a1;
				--pitch12-secondary-channel:#965cbc;
				--pitch12-primary-channel:  #c26afc;
				--pitch12-secondary-note:   #965cbc;
				--pitch12-primary-note:     #c26afc;
				--noise1-secondary-channel: #991010;
				--noise1-primary-channel:   #ff1616;
				--noise1-secondary-note:    #991010;
				--noise1-primary-note:      #ff1616;
				--noise2-secondary-channel: #aaaaaa;
				--noise2-primary-channel:   #ffffff;
				--noise2-secondary-note:    #aaaaaa;
				--noise2-primary-note:      #ffffff;
				--noise3-secondary-channel: #5869BD;
				--noise3-primary-channel:   #768dfc;
				--noise3-secondary-note:    #5869BD;
				--noise3-primary-note:      #768dfc;
				--noise4-secondary-channel: #7c9b42;
				--noise4-primary-channel:   #a5ff00;
				--noise4-secondary-note:    #7c9b42;
				--noise4-primary-note:      #a5ff00;
				}
		`,
        "kahootiest": `
		:root {
				--page-margin: black;
				--editor-background: black;
				--hover-preview: white;
				--playhead: white;
				--primary-text: white;
				--secondary-text: #999;
				--inverted-text: black;
				--text-selection: rgba(119,68,255,0.99);
				--box-selection-fill: rgba(255,255,255,0.2);
				--loop-accent: #ff3355;
				--link-accent: #98f;
				--ui-widget-background: #363636;
				--ui-widget-focus: #777;
				--volume-icon: #66bf39;	

				--tonic: #45a3e5;
				--fifth-note: #864cbf;
				--pitch-background: #444;

				--octave-scrollbar: #eb670f; 
				--scrollbar-octave: #ff3355;

				--pitch1-secondary-channel: #0099a1;
				--pitch1-primary-channel:   #25f3ff;
				--pitch1-secondary-note:    #0099a1;
				--pitch1-primary-note:      #25f3ff;
				--pitch2-secondary-channel: #439143;
				--pitch2-primary-channel:   #44ff44;
				--pitch2-secondary-note:    #439143;
				--pitch2-primary-note:      #44ff44;
				--pitch3-secondary-channel: #a1a100;
				--pitch3-primary-channel:   #ffff25;
				--pitch3-secondary-note:    #a1a100;
				--pitch3-primary-note:      #ffff25;
				--pitch4-secondary-channel: #c75000;
				--pitch4-primary-channel:   #ff9752;
				--pitch4-secondary-note:    #c75000;
				--pitch4-primary-note:      #ff9752;
				--pitch5-secondary-channel: #d020d0;
				--pitch5-primary-channel:   #FF90FF;
				--pitch5-secondary-note:    #d020d0;
				--pitch5-primary-note:      #ff90ff;
				--pitch6-secondary-channel: #552377;
				--pitch6-primary-channel:   #9f31ea;
				--pitch6-secondary-note:    #552377;
				--pitch6-primary-note:      #9f31ea;
				--pitch7-secondary-channel: #221b89;
				--pitch7-primary-channel:   #2b6aff;
				--pitch7-secondary-note:    #221b89;
				--pitch7-primary-note:      #2b6aff;
				--pitch8-secondary-channel: #00995f;
				--pitch8-primary-channel:   #00ff9f;
				--pitch8-secondary-note:    #00995f;
				--pitch8-primary-note:      #00ff9f;
				--pitch9-secondary-channel: #d6b03e;
				--pitch9-primary-channel:   #ffbf00;
				--pitch9-secondary-note:    #d6b03e;
				--pitch9-primary-note:      #ffbf00;
				--pitch10-secondary-channel:#b25915;
				--pitch10-primary-channel:  #d85d00;
				--pitch10-secondary-note:   #b25915;
				--pitch10-primary-note:     #d85d00;
				--pitch11-secondary-channel:#891a60;
				--pitch11-primary-channel:  #ff00a1;
				--pitch11-secondary-note:   #891a60;
				--pitch11-primary-note:     #ff00a1;
				--pitch12-secondary-channel:#965cbc;
				--pitch12-primary-channel:  #c26afc;
				--pitch12-secondary-note:   #965cbc;
				--pitch12-primary-note:     #c26afc;
				--noise1-secondary-channel: #991010;
				--noise1-primary-channel:   #ff1616;
				--noise1-secondary-note:    #991010;
				--noise1-primary-note:      #ff1616;
				--noise2-secondary-channel: #aaaaaa;
				--noise2-primary-channel:   #ffffff;
				--noise2-secondary-note:    #aaaaaa;
				--noise2-primary-note:      #ffffff;
				--noise3-secondary-channel: #5869BD;
				--noise3-primary-channel:   #768dfc;
				--noise3-secondary-note:    #5869BD;
				--noise3-primary-note:      #768dfc;
				--noise4-secondary-channel: #7c9b42;
				--noise4-primary-channel:   #a5ff00;
				--noise4-secondary-note:    #7c9b42;
				--noise4-primary-note:      #a5ff00;
				}
		`,
        "beambit": `
		:root {
				--page-margin: black;
				--editor-background: black;
				--hover-preview: white;
				--playhead: white;
				--primary-text: white;
				--secondary-text: #999;
				--inverted-text: black;
				--text-selection: rgba(119,68,255,0.99);
				--box-selection-fill: rgba(255,255,255,0.2);
				--loop-accent: #fefe00;
				--link-accent: #98f;
				--ui-widget-background: #363636;
				--ui-widget-focus: #777;
				--volume-icon: #fefe00;	

				--pitch-background: #444;

				--tonic: #fefe00;
				--pitch1-background: #111111; 
				--pitch2-background: #111111; 
				--pitch3-background: #111111; 
				--pitch4-background: #fa0103;
				--pitch5-background: #111111; 
				--pitch6-background: #111111; 
				--fifth-note: #111111; 
				--pitch8-background: #0001fc; 
				--pitch9-background: #111111; 
				--pitch10-background: #111111; 
				--pitch11-background: #111111;

				--octave-scrollbar: #0001fc; 
				--scrollbar-octave: #fa0103;

				--pitch1-secondary-channel: #0099a1;
				--pitch1-primary-channel:   #25f3ff;
				--pitch1-secondary-note:    #0099a1;
				--pitch1-primary-note:      #25f3ff;
				--pitch2-secondary-channel: #439143;
				--pitch2-primary-channel:   #44ff44;
				--pitch2-secondary-note:    #439143;
				--pitch2-primary-note:      #44ff44;
				--pitch3-secondary-channel: #a1a100;
				--pitch3-primary-channel:   #ffff25;
				--pitch3-secondary-note:    #a1a100;
				--pitch3-primary-note:      #ffff25;
				--pitch4-secondary-channel: #c75000;
				--pitch4-primary-channel:   #ff9752;
				--pitch4-secondary-note:    #c75000;
				--pitch4-primary-note:      #ff9752;
				--pitch5-secondary-channel: #d020d0;
				--pitch5-primary-channel:   #FF90FF;
				--pitch5-secondary-note:    #d020d0;
				--pitch5-primary-note:      #ff90ff;
				--pitch6-secondary-channel: #552377;
				--pitch6-primary-channel:   #9f31ea;
				--pitch6-secondary-note:    #552377;
				--pitch6-primary-note:      #9f31ea;
				--pitch7-secondary-channel: #221b89;
				--pitch7-primary-channel:   #2b6aff;
				--pitch7-secondary-note:    #221b89;
				--pitch7-primary-note:      #2b6aff;
				--pitch8-secondary-channel: #00995f;
				--pitch8-primary-channel:   #00ff9f;
				--pitch8-secondary-note:    #00995f;
				--pitch8-primary-note:      #00ff9f;
				--pitch9-secondary-channel: #d6b03e;
				--pitch9-primary-channel:   #ffbf00;
				--pitch9-secondary-note:    #d6b03e;
				--pitch9-primary-note:      #ffbf00;
				--pitch10-secondary-channel:#b25915;
				--pitch10-primary-channel:  #d85d00;
				--pitch10-secondary-note:   #b25915;
				--pitch10-primary-note:     #d85d00;
				--pitch11-secondary-channel:#891a60;
				--pitch11-primary-channel:  #ff00a1;
				--pitch11-secondary-note:   #891a60;
				--pitch11-primary-note:     #ff00a1;
				--pitch12-secondary-channel:#965cbc;
				--pitch12-primary-channel:  #c26afc;
				--pitch12-secondary-note:   #965cbc;
				--pitch12-primary-note:     #c26afc;
				--noise1-secondary-channel: #991010;
				--noise1-primary-channel:   #ff1616;
				--noise1-secondary-note:    #991010;
				--noise1-primary-note:      #ff1616;
				--noise2-secondary-channel: #aaaaaa;
				--noise2-primary-channel:   #ffffff;
				--noise2-secondary-note:    #aaaaaa;
				--noise2-primary-note:      #ffffff;
				--noise3-secondary-channel: #5869BD;
				--noise3-primary-channel:   #768dfc;
				--noise3-secondary-note:    #5869BD;
				--noise3-primary-note:      #768dfc;
				--noise4-secondary-channel: #7c9b42;
				--noise4-primary-channel:   #a5ff00;
				--noise4-secondary-note:    #7c9b42;
				--noise4-primary-note:      #a5ff00;
				}
		`,
        "egg": `
		:root {
				--page-margin: black;
				--editor-background: black;
				--hover-preview: white;
				--playhead: white;
				--primary-text: white;
				--secondary-text: #999;
				--inverted-text: black;
				--text-selection: rgba(119,68,255,0.99);
				--box-selection-fill: rgba(255,255,255,0.2);
				--loop-accent: #6b003a;
				--link-accent: #98f;
				--ui-widget-background: #363636;
				--ui-widget-focus: #777;
				--volume-icon: #f01d7a;	

				--tonic: #fffafa;
				--fifth-note: #ff91ce;
				--pitch-background: #444;

				--octave-scrollbar: #ffb1f4; 
				--scrollbar-octave: #b4001b;

				--pitch1-secondary-channel: #0099a1;
				--pitch1-primary-channel:   #25f3ff;
				--pitch1-secondary-note:    #0099a1;
				--pitch1-primary-note:      #25f3ff;
				--pitch2-secondary-channel: #439143;
				--pitch2-primary-channel:   #44ff44;
				--pitch2-secondary-note:    #439143;
				--pitch2-primary-note:      #44ff44;
				--pitch3-secondary-channel: #a1a100;
				--pitch3-primary-channel:   #ffff25;
				--pitch3-secondary-note:    #a1a100;
				--pitch3-primary-note:      #ffff25;
				--pitch4-secondary-channel: #c75000;
				--pitch4-primary-channel:   #ff9752;
				--pitch4-secondary-note:    #c75000;
				--pitch4-primary-note:      #ff9752;
				--pitch5-secondary-channel: #d020d0;
				--pitch5-primary-channel:   #FF90FF;
				--pitch5-secondary-note:    #d020d0;
				--pitch5-primary-note:      #ff90ff;
				--pitch6-secondary-channel: #552377;
				--pitch6-primary-channel:   #9f31ea;
				--pitch6-secondary-note:    #552377;
				--pitch6-primary-note:      #9f31ea;
				--pitch7-secondary-channel: #221b89;
				--pitch7-primary-channel:   #2b6aff;
				--pitch7-secondary-note:    #221b89;
				--pitch7-primary-note:      #2b6aff;
				--pitch8-secondary-channel: #00995f;
				--pitch8-primary-channel:   #00ff9f;
				--pitch8-secondary-note:    #00995f;
				--pitch8-primary-note:      #00ff9f;
				--pitch9-secondary-channel: #d6b03e;
				--pitch9-primary-channel:   #ffbf00;
				--pitch9-secondary-note:    #d6b03e;
				--pitch9-primary-note:      #ffbf00;
				--pitch10-secondary-channel:#b25915;
				--pitch10-primary-channel:  #d85d00;
				--pitch10-secondary-note:   #b25915;
				--pitch10-primary-note:     #d85d00;
				--pitch11-secondary-channel:#891a60;
				--pitch11-primary-channel:  #ff00a1;
				--pitch11-secondary-note:   #891a60;
				--pitch11-primary-note:     #ff00a1;
				--pitch12-secondary-channel:#965cbc;
				--pitch12-primary-channel:  #c26afc;
				--pitch12-secondary-note:   #965cbc;
				--pitch12-primary-note:     #c26afc;
				--noise1-secondary-channel: #991010;
				--noise1-primary-channel:   #ff1616;
				--noise1-secondary-note:    #991010;
				--noise1-primary-note:      #ff1616;
				--noise2-secondary-channel: #aaaaaa;
				--noise2-primary-channel:   #ffffff;
				--noise2-secondary-note:    #aaaaaa;
				--noise2-primary-note:      #ffffff;
				--noise3-secondary-channel: #5869BD;
				--noise3-primary-channel:   #768dfc;
				--noise3-secondary-note:    #5869BD;
				--noise3-primary-note:      #768dfc;
				--noise4-secondary-channel: #7c9b42;
				--noise4-primary-channel:   #a5ff00;
				--noise4-secondary-note:    #7c9b42;
				--noise4-primary-note:      #a5ff00;
				}
		`,
        "Poniryoshka": `
		:root {
				--page-margin: black;
				--editor-background: black;
				--hover-preview: white;
				--playhead: white;
				--primary-text: white;
				--secondary-text: #999;
				--inverted-text: black;
				--text-selection: rgba(119,68,255,0.99);
				--box-selection-fill: rgba(255,255,255,0.2);
				--loop-accent: #4b4b4b;
				--link-accent: #98f;
				--ui-widget-background: #363636;
				--ui-widget-focus: #777;
				--volume-icon: #ffc100;	

				--tonic: #1a2844;
				--fifth-note: #dabbe6;
				--pitch4-background: #faf4c3;
				--pitch-background: #444;

				--octave-scrollbar: #5f4c99; 
				--scrollbar-octave: #ff8291;

				--pitch1-secondary-channel: #0099a1;
				--pitch1-primary-channel:   #25f3ff;
				--pitch1-secondary-note:    #0099a1;
				--pitch1-primary-note:      #25f3ff;
				--pitch2-secondary-channel: #439143;
				--pitch2-primary-channel:   #44ff44;
				--pitch2-secondary-note:    #439143;
				--pitch2-primary-note:      #44ff44;
				--pitch3-secondary-channel: #a1a100;
				--pitch3-primary-channel:   #ffff25;
				--pitch3-secondary-note:    #a1a100;
				--pitch3-primary-note:      #ffff25;
				--pitch4-secondary-channel: #c75000;
				--pitch4-primary-channel:   #ff9752;
				--pitch4-secondary-note:    #c75000;
				--pitch4-primary-note:      #ff9752;
				--pitch5-secondary-channel: #d020d0;
				--pitch5-primary-channel:   #FF90FF;
				--pitch5-secondary-note:    #d020d0;
				--pitch5-primary-note:      #ff90ff;
				--pitch6-secondary-channel: #552377;
				--pitch6-primary-channel:   #9f31ea;
				--pitch6-secondary-note:    #552377;
				--pitch6-primary-note:      #9f31ea;
				--pitch7-secondary-channel: #221b89;
				--pitch7-primary-channel:   #2b6aff;
				--pitch7-secondary-note:    #221b89;
				--pitch7-primary-note:      #2b6aff;
				--pitch8-secondary-channel: #00995f;
				--pitch8-primary-channel:   #00ff9f;
				--pitch8-secondary-note:    #00995f;
				--pitch8-primary-note:      #00ff9f;
				--pitch9-secondary-channel: #d6b03e;
				--pitch9-primary-channel:   #ffbf00;
				--pitch9-secondary-note:    #d6b03e;
				--pitch9-primary-note:      #ffbf00;
				--pitch10-secondary-channel:#b25915;
				--pitch10-primary-channel:  #d85d00;
				--pitch10-secondary-note:   #b25915;
				--pitch10-primary-note:     #d85d00;
				--pitch11-secondary-channel:#891a60;
				--pitch11-primary-channel:  #ff00a1;
				--pitch11-secondary-note:   #891a60;
				--pitch11-primary-note:     #ff00a1;
				--pitch12-secondary-channel:#965cbc;
				--pitch12-primary-channel:  #c26afc;
				--pitch12-secondary-note:   #965cbc;
				--pitch12-primary-note:     #c26afc;
				--noise1-secondary-channel: #991010;
				--noise1-primary-channel:   #ff1616;
				--noise1-secondary-note:    #991010;
				--noise1-primary-note:      #ff1616;
				--noise2-secondary-channel: #aaaaaa;
				--noise2-primary-channel:   #ffffff;
				--noise2-secondary-note:    #aaaaaa;
				--noise2-primary-note:      #ffffff;
				--noise3-secondary-channel: #5869BD;
				--noise3-primary-channel:   #768dfc;
				--noise3-secondary-note:    #5869BD;
				--noise3-primary-note:      #768dfc;
				--noise4-secondary-channel: #7c9b42;
				--noise4-primary-channel:   #a5ff00;
				--noise4-secondary-note:    #7c9b42;
				--noise4-primary-note:      #a5ff00;
				}
		`,
        "gameboy": `
		:root {
				--page-margin: black;
				--editor-background: black;
				--hover-preview: white;
				--playhead: white;
				--primary-text: white;
				--secondary-text: #999;
				--inverted-text: black;
				--text-selection: rgba(119,68,255,0.99);
				--box-selection-fill: rgba(255,255,255,0.2);
				--loop-accent: #9bbc0f;
				--link-accent: #98f;
				--ui-widget-background: #363636;
				--ui-widget-focus: #777;
				--volume-icon: #8bac0f;	

				--tonic: #9bbc0f; 
				--pitch1-background: #9bbc0f; 
				--pitch2-background: #9bbc0f; 
				--pitch3-background: #9bbc0f; 
				--pitch4-background: #9bbc0f;
				--pitch5-background: #9bbc0f; 
				--pitch6-background: #306230; 
				--fifth-note: #306230; 
				--pitch8-background: #306230; 
				--pitch9-background: #0f380f; 
				--pitch10-background: #0f380f; 
				--pitch11-background: #0f380f; 
				--pitch-background: #444;

				--octave-scrollbar: #9bbc0f; 
				--scrollbar-octave: #8bac0f;

				--pitch1-secondary-channel: #0099a1;
				--pitch1-primary-channel:   #25f3ff;
				--pitch1-secondary-note:    #0099a1;
				--pitch1-primary-note:      #25f3ff;
				--pitch2-secondary-channel: #439143;
				--pitch2-primary-channel:   #44ff44;
				--pitch2-secondary-note:    #439143;
				--pitch2-primary-note:      #44ff44;
				--pitch3-secondary-channel: #a1a100;
				--pitch3-primary-channel:   #ffff25;
				--pitch3-secondary-note:    #a1a100;
				--pitch3-primary-note:      #ffff25;
				--pitch4-secondary-channel: #c75000;
				--pitch4-primary-channel:   #ff9752;
				--pitch4-secondary-note:    #c75000;
				--pitch4-primary-note:      #ff9752;
				--pitch5-secondary-channel: #d020d0;
				--pitch5-primary-channel:   #FF90FF;
				--pitch5-secondary-note:    #d020d0;
				--pitch5-primary-note:      #ff90ff;
				--pitch6-secondary-channel: #552377;
				--pitch6-primary-channel:   #9f31ea;
				--pitch6-secondary-note:    #552377;
				--pitch6-primary-note:      #9f31ea;
				--pitch7-secondary-channel: #221b89;
				--pitch7-primary-channel:   #2b6aff;
				--pitch7-secondary-note:    #221b89;
				--pitch7-primary-note:      #2b6aff;
				--pitch8-secondary-channel: #00995f;
				--pitch8-primary-channel:   #00ff9f;
				--pitch8-secondary-note:    #00995f;
				--pitch8-primary-note:      #00ff9f;
				--pitch9-secondary-channel: #d6b03e;
				--pitch9-primary-channel:   #ffbf00;
				--pitch9-secondary-note:    #d6b03e;
				--pitch9-primary-note:      #ffbf00;
				--pitch10-secondary-channel:#b25915;
				--pitch10-primary-channel:  #d85d00;
				--pitch10-secondary-note:   #b25915;
				--pitch10-primary-note:     #d85d00;
				--pitch11-secondary-channel:#891a60;
				--pitch11-primary-channel:  #ff00a1;
				--pitch11-secondary-note:   #891a60;
				--pitch11-primary-note:     #ff00a1;
				--pitch12-secondary-channel:#965cbc;
				--pitch12-primary-channel:  #c26afc;
				--pitch12-secondary-note:   #965cbc;
				--pitch12-primary-note:     #c26afc;
				--noise1-secondary-channel: #991010;
				--noise1-primary-channel:   #ff1616;
				--noise1-secondary-note:    #991010;
				--noise1-primary-note:      #ff1616;
				--noise2-secondary-channel: #aaaaaa;
				--noise2-primary-channel:   #ffffff;
				--noise2-secondary-note:    #aaaaaa;
				--noise2-primary-note:      #ffffff;
				--noise3-secondary-channel: #5869BD;
				--noise3-primary-channel:   #768dfc;
				--noise3-secondary-note:    #5869BD;
				--noise3-primary-note:      #768dfc;
				--noise4-secondary-channel: #7c9b42;
				--noise4-primary-channel:   #a5ff00;
				--noise4-secondary-note:    #7c9b42;
				--noise4-primary-note:      #a5ff00;
				}
		`,
        "woodkid": `
		:root {
				--page-margin: black;
				--editor-background: black;
				--hover-preview: white;
				--playhead: white;
				--primary-text: white;
				--secondary-text: #999;
				--inverted-text: black;
				--text-selection: rgba(119,68,255,0.99);
				--box-selection-fill: rgba(255,255,255,0.2);
				--loop-accent: #e83c4e;
				--link-accent: #98f;
				--ui-widget-background: #363636;
				--ui-widget-focus: #777;
				--volume-icon: #ef3027;	

				--tonic: #fff6fe;
				--pitch1-background: #41323b;
				--pitch2-background: #41323b;
				--pitch3-background: #41323b;
				--pitch4-background: #fff6fe;
				--pitch5-background: #41323b;
				--pitch6-background: #41323b;
				--fifth-note: #fff6fe;
				--pitch8-background: #41323b;
				--pitch9-background: #41323b;
				--pitch10-background: #41323b;
				--pitch11-background: #41323b;
				--pitch-background: #444;

				--octave-scrollbar: #ef3027; 
				--scrollbar-octave: #ffedca;

				--pitch1-secondary-channel: #0099a1;
				--pitch1-primary-channel:   #25f3ff;
				--pitch1-secondary-note:    #0099a1;
				--pitch1-primary-note:      #25f3ff;
				--pitch2-secondary-channel: #439143;
				--pitch2-primary-channel:   #44ff44;
				--pitch2-secondary-note:    #439143;
				--pitch2-primary-note:      #44ff44;
				--pitch3-secondary-channel: #a1a100;
				--pitch3-primary-channel:   #ffff25;
				--pitch3-secondary-note:    #a1a100;
				--pitch3-primary-note:      #ffff25;
				--pitch4-secondary-channel: #c75000;
				--pitch4-primary-channel:   #ff9752;
				--pitch4-secondary-note:    #c75000;
				--pitch4-primary-note:      #ff9752;
				--pitch5-secondary-channel: #d020d0;
				--pitch5-primary-channel:   #FF90FF;
				--pitch5-secondary-note:    #d020d0;
				--pitch5-primary-note:      #ff90ff;
				--pitch6-secondary-channel: #552377;
				--pitch6-primary-channel:   #9f31ea;
				--pitch6-secondary-note:    #552377;
				--pitch6-primary-note:      #9f31ea;
				--pitch7-secondary-channel: #221b89;
				--pitch7-primary-channel:   #2b6aff;
				--pitch7-secondary-note:    #221b89;
				--pitch7-primary-note:      #2b6aff;
				--pitch8-secondary-channel: #00995f;
				--pitch8-primary-channel:   #00ff9f;
				--pitch8-secondary-note:    #00995f;
				--pitch8-primary-note:      #00ff9f;
				--pitch9-secondary-channel: #d6b03e;
				--pitch9-primary-channel:   #ffbf00;
				--pitch9-secondary-note:    #d6b03e;
				--pitch9-primary-note:      #ffbf00;
				--pitch10-secondary-channel:#b25915;
				--pitch10-primary-channel:  #d85d00;
				--pitch10-secondary-note:   #b25915;
				--pitch10-primary-note:     #d85d00;
				--pitch11-secondary-channel:#891a60;
				--pitch11-primary-channel:  #ff00a1;
				--pitch11-secondary-note:   #891a60;
				--pitch11-primary-note:     #ff00a1;
				--pitch12-secondary-channel:#965cbc;
				--pitch12-primary-channel:  #c26afc;
				--pitch12-secondary-note:   #965cbc;
				--pitch12-primary-note:     #c26afc;
				--noise1-secondary-channel: #991010;
				--noise1-primary-channel:   #ff1616;
				--noise1-secondary-note:    #991010;
				--noise1-primary-note:      #ff1616;
				--noise2-secondary-channel: #aaaaaa;
				--noise2-primary-channel:   #ffffff;
				--noise2-secondary-note:    #aaaaaa;
				--noise2-primary-note:      #ffffff;
				--noise3-secondary-channel: #5869BD;
				--noise3-primary-channel:   #768dfc;
				--noise3-secondary-note:    #5869BD;
				--noise3-primary-note:      #768dfc;
				--noise4-secondary-channel: #7c9b42;
				--noise4-primary-channel:   #a5ff00;
				--noise4-secondary-note:    #7c9b42;
				--noise4-primary-note:      #a5ff00;
				}
		`,
        "midnight": `
		:root {
				--page-margin: black;
				--editor-background: black;
				--hover-preview: white;
				--playhead: white;
				--primary-text: white;
				--secondary-text: #999;
				--inverted-text: black;
				--text-selection: rgba(119,68,255,0.99);
				--box-selection-fill: rgba(255,255,255,0.2);
				--loop-accent: #445566;
				--link-accent: #98f;
				--ui-widget-background: #363636;
				--ui-widget-focus: #777;
				--volume-icon: #aa5599;	

				--tonic: #222222;
				--pitch1-background: #222222;
				--pitch2-background: #222222;
				--pitch3-background: #222222;
				--pitch4-background: #222222;
				--pitch5-background: #222222;
				--pitch6-background:#222222;
				--fifth-note: #444444;
				--pitch8-background: #222222;
				--pitch9-background: #222222;
				--pitch10-background: #222222;
				--pitch11-background: #222222;
				--pitch-background: #444;

				--octave-scrollbar: #444444; 
				--scrollbar-octave: #aa5599;

				--pitch1-secondary-channel: #0099a1;
				--pitch1-primary-channel:   #25f3ff;
				--pitch1-secondary-note:    #0099a1;
				--pitch1-primary-note:      #25f3ff;
				--pitch2-secondary-channel: #439143;
				--pitch2-primary-channel:   #44ff44;
				--pitch2-secondary-note:    #439143;
				--pitch2-primary-note:      #44ff44;
				--pitch3-secondary-channel: #a1a100;
				--pitch3-primary-channel:   #ffff25;
				--pitch3-secondary-note:    #a1a100;
				--pitch3-primary-note:      #ffff25;
				--pitch4-secondary-channel: #c75000;
				--pitch4-primary-channel:   #ff9752;
				--pitch4-secondary-note:    #c75000;
				--pitch4-primary-note:      #ff9752;
				--pitch5-secondary-channel: #d020d0;
				--pitch5-primary-channel:   #FF90FF;
				--pitch5-secondary-note:    #d020d0;
				--pitch5-primary-note:      #ff90ff;
				--pitch6-secondary-channel: #552377;
				--pitch6-primary-channel:   #9f31ea;
				--pitch6-secondary-note:    #552377;
				--pitch6-primary-note:      #9f31ea;
				--pitch7-secondary-channel: #221b89;
				--pitch7-primary-channel:   #2b6aff;
				--pitch7-secondary-note:    #221b89;
				--pitch7-primary-note:      #2b6aff;
				--pitch8-secondary-channel: #00995f;
				--pitch8-primary-channel:   #00ff9f;
				--pitch8-secondary-note:    #00995f;
				--pitch8-primary-note:      #00ff9f;
				--pitch9-secondary-channel: #d6b03e;
				--pitch9-primary-channel:   #ffbf00;
				--pitch9-secondary-note:    #d6b03e;
				--pitch9-primary-note:      #ffbf00;
				--pitch10-secondary-channel:#b25915;
				--pitch10-primary-channel:  #d85d00;
				--pitch10-secondary-note:   #b25915;
				--pitch10-primary-note:     #d85d00;
				--pitch11-secondary-channel:#891a60;
				--pitch11-primary-channel:  #ff00a1;
				--pitch11-secondary-note:   #891a60;
				--pitch11-primary-note:     #ff00a1;
				--pitch12-secondary-channel:#965cbc;
				--pitch12-primary-channel:  #c26afc;
				--pitch12-secondary-note:   #965cbc;
				--pitch12-primary-note:     #c26afc;
				--noise1-secondary-channel: #991010;
				--noise1-primary-channel:   #ff1616;
				--noise1-secondary-note:    #991010;
				--noise1-primary-note:      #ff1616;
				--noise2-secondary-channel: #aaaaaa;
				--noise2-primary-channel:   #ffffff;
				--noise2-secondary-note:    #aaaaaa;
				--noise2-primary-note:      #ffffff;
				--noise3-secondary-channel: #5869BD;
				--noise3-primary-channel:   #768dfc;
				--noise3-secondary-note:    #5869BD;
				--noise3-primary-note:      #768dfc;
				--noise4-secondary-channel: #7c9b42;
				--noise4-primary-channel:   #a5ff00;
				--noise4-secondary-note:    #7c9b42;
				--noise4-primary-note:      #a5ff00;
				}
		`,
        "snedbox": `
		:root {
			--page-margin: black;
			--editor-background: black;
			--hover-preview: white;
			--playhead: white;
			--primary-text: white;
			--secondary-text: #999;
			--inverted-text: black;
			--text-selection: rgba(119,68,255,0.99);
			--box-selection-fill: rgba(255,255,255,0.2);
			--loop-accent: #a53a3d;
			--link-accent: #98f;
			--ui-widget-background: #363636;
			--ui-widget-focus: #777;
			--pitch-background: #444;
			--tonic: #864;
			--fifth-note: #60389b;
			--pitch4-background: #10997e;
			--volume-icon: #a53a3d;
			--octave-scrollbar: #444;
			--scrollbar-octave: #a53a3d;
			--channel-box: #444;

			--pitch1-secondary-channel: #0099a1;
			--pitch1-primary-channel:   #25f3ff;
			--pitch1-secondary-note:    #0099a1;
			--pitch1-primary-note:      #25f3ff;
			--pitch2-secondary-channel: #439143;
			--pitch2-primary-channel:   #44ff44;
			--pitch2-secondary-note:    #439143;
			--pitch2-primary-note:      #44ff44;
			--pitch3-secondary-channel: #a1a100;
			--pitch3-primary-channel:   #ffff25;
			--pitch3-secondary-note:    #a1a100;
			--pitch3-primary-note:      #ffff25;
			--pitch4-secondary-channel: #c75000;
			--pitch4-primary-channel:   #ff9752;
			--pitch4-secondary-note:    #c75000;
			--pitch4-primary-note:      #ff9752;
			--pitch5-secondary-channel: #d020d0;
			--pitch5-primary-channel:   #FF90FF;
			--pitch5-secondary-note:    #d020d0;
			--pitch5-primary-note:      #ff90ff;
			--pitch6-secondary-channel: #552377;
			--pitch6-primary-channel:   #9f31ea;
			--pitch6-secondary-note:    #552377;
			--pitch6-primary-note:      #9f31ea;
			--pitch7-secondary-channel: #221b89;
			--pitch7-primary-channel:   #2b6aff;
			--pitch7-secondary-note:    #221b89;
			--pitch7-primary-note:      #2b6aff;
			--pitch8-secondary-channel: #00995f;
			--pitch8-primary-channel:   #00ff9f;
			--pitch8-secondary-note:    #00995f;
			--pitch8-primary-note:      #00ff9f;
			--pitch9-secondary-channel: #d6b03e;
			--pitch9-primary-channel:   #ffbf00;
			--pitch9-secondary-note:    #d6b03e;
			--pitch9-primary-note:      #ffbf00;
			--pitch10-secondary-channel:#b25915;
			--pitch10-primary-channel:  #d85d00;
			--pitch10-secondary-note:   #b25915;
			--pitch10-primary-note:     #d85d00;

			--pitch11-secondary-channel:#891a60;
			--pitch11-primary-channel:  #ff00a1;
			--pitch11-secondary-note:   #891a60;
			--pitch11-primary-note:     #ff00a1;

			--pitch12-secondary-channel:#965cbc;
			--pitch12-primary-channel:  #c26afc;
			--pitch12-secondary-note:   #965cbc;
			--pitch12-primary-note:     #c26afc;

			--noise1-secondary-channel: #991010;
			--noise1-primary-channel:   #ff1616;
			--noise1-secondary-note:    #991010;
			--noise1-primary-note:      #ff1616;
			--noise2-secondary-channel: #aaaaaa;
			--noise2-primary-channel:   #ffffff;
			--noise2-secondary-note:    #aaaaaa;
			--noise2-primary-note:      #ffffff;
			--noise3-secondary-channel: #5869BD;
			--noise3-primary-channel:   #768dfc;
			--noise3-secondary-note:    #5869BD;
			--noise3-primary-note:      #768dfc;
			--noise4-secondary-channel: #7c9b42;
			--noise4-primary-channel:   #a5ff00;
			--noise4-secondary-note:    #7c9b42;
			--noise4-primary-note:      #a5ff00;
		}
	`,
        "unnamed": `
	:root {
			--page-margin: black;
			--editor-background: black;
			--hover-preview: white;
			--playhead: white;
			--primary-text: white;
			--secondary-text: #999;
			--inverted-text: black;
			--text-selection: rgba(119,68,255,0.99);
			--box-selection-fill: rgba(255,255,255,0.2);
			--loop-accent: #ffffff;
			--link-accent: #98f;
			--ui-widget-background: #363636;
			--ui-widget-focus: #777;
			--pitch-background: #444;
			--pitch1-background: #ffffa0;
			--pitch2-background: #ffffa0;
			--pitch3-background: #ffffa0;
			--pitch4-background: #ffffa0;
			--pitch5-background: #ffffa0;
			--pitch6-background: #ffffa0;
			--pitch8-background: #ffffa0;
			--pitch9-background: #ffffa0;
			--pitch10-background: #ffffa0;
			--pitch11-background: #ffffa0;
			--pitch12-background: #ffffa0;
			--tonic: #ffffa0;
			--fifth-note: #ffffa0;
			--volume-icon: #ffffff;	

			--octave-scrollbar: #ffffff;
			--scrollbar-octave: #ffffff;

			--pitch1-secondary-channel: #0099a1;
			--pitch1-primary-channel:   #25f3ff;
			--pitch1-secondary-note:    #0099a1;
			--pitch1-primary-note:      #25f3ff;
			--pitch2-secondary-channel: #439143;
			--pitch2-primary-channel:   #44ff44;
			--pitch2-secondary-note:    #439143;
			--pitch2-primary-note:      #44ff44;
			--pitch3-secondary-channel: #a1a100;
			--pitch3-primary-channel:   #ffff25;
			--pitch3-secondary-note:    #a1a100;
			--pitch3-primary-note:      #ffff25;
			--pitch4-secondary-channel: #c75000;
			--pitch4-primary-channel:   #ff9752;
			--pitch4-secondary-note:    #c75000;
			--pitch4-primary-note:      #ff9752;
			--pitch5-secondary-channel: #d020d0;
			--pitch5-primary-channel:   #FF90FF;
			--pitch5-secondary-note:    #d020d0;
			--pitch5-primary-note:      #ff90ff;
			--pitch6-secondary-channel: #552377;
			--pitch6-primary-channel:   #9f31ea;
			--pitch6-secondary-note:    #552377;
			--pitch6-primary-note:      #9f31ea;
			--pitch7-secondary-channel: #221b89;
			--pitch7-primary-channel:   #2b6aff;
			--pitch7-secondary-note:    #221b89;
			--pitch7-primary-note:      #2b6aff;
			--pitch8-secondary-channel: #00995f;
			--pitch8-primary-channel:   #00ff9f;
			--pitch8-secondary-note:    #00995f;
			--pitch8-primary-note:      #00ff9f;
			--pitch9-secondary-channel: #d6b03e;
			--pitch9-primary-channel:   #ffbf00;
			--pitch9-secondary-note:    #d6b03e;
			--pitch9-primary-note:      #ffbf00;
			--pitch10-secondary-channel:#b25915;
			--pitch10-primary-channel:  #d85d00;
			--pitch10-secondary-note:   #b25915;
			--pitch10-primary-note:     #d85d00;
			--pitch11-secondary-channel:#891a60;
			--pitch11-primary-channel:  #ff00a1;
			--pitch11-secondary-note:   #891a60;
			--pitch11-primary-note:     #ff00a1;
			--pitch12-secondary-channel:#965cbc;
			--pitch12-primary-channel:  #c26afc;
			--pitch12-secondary-note:   #965cbc;
			--pitch12-primary-note:     #c26afc;
			--noise1-secondary-channel: #991010;
			--noise1-primary-channel:   #ff1616;
			--noise1-secondary-note:    #991010;
			--noise1-primary-note:      #ff1616;
			--noise2-secondary-channel: #aaaaaa;
			--noise2-primary-channel:   #ffffff;
			--noise2-secondary-note:    #aaaaaa;
			--noise2-primary-note:      #ffffff;
			--noise3-secondary-channel: #5869BD;
			--noise3-primary-channel:   #768dfc;
			--noise3-secondary-note:    #5869BD;
			--noise3-primary-note:      #768dfc;
			--noise4-secondary-channel: #7c9b42;
			--noise4-primary-channel:   #a5ff00;
			--noise4-secondary-note:    #7c9b42;
			--noise4-primary-note:      #a5ff00;
			}
	`,
        "piano": `
	:root {
			--page-margin: black;
			--editor-background: black;
			--hover-preview: white;
			--playhead: white;
			--primary-text: white;
			--secondary-text: #999;
			--inverted-text: black;
			--text-selection: rgba(119,68,255,0.99);
			--box-selection-fill: rgba(255,255,255,0.2);
			--loop-accent: #ffffff;
			--link-accent: #98f;
			--ui-widget-background: #363636;
			--ui-widget-focus: #777;

			--use-piano-scheme: true;

			--pitch-background: #444;
			--volume-icon: #ff0000;	

			--tonic: #ffffff;
			--white-tonic: #fff;
			--black-tonic: #222;
			--fifth-note: #7a7a7a;

			--octave-scrollbar: #211616;
			--scrollbar-octave: #ff4c4c;
			--pitch-white-key: #bfbfbf;
			--pitch-black-key: #7a7a7a;

			--pitch1-secondary-channel: #0099a1;
			--pitch1-primary-channel:   #25f3ff;
			--pitch1-secondary-note:    #0099a1;
			--pitch1-primary-note:      #25f3ff;
			--pitch2-secondary-channel: #439143;
			--pitch2-primary-channel:   #44ff44;
			--pitch2-secondary-note:    #439143;
			--pitch2-primary-note:      #44ff44;
			--pitch3-secondary-channel: #a1a100;
			--pitch3-primary-channel:   #ffff25;
			--pitch3-secondary-note:    #a1a100;
			--pitch3-primary-note:      #ffff25;
			--pitch4-secondary-channel: #c75000;
			--pitch4-primary-channel:   #ff9752;
			--pitch4-secondary-note:    #c75000;
			--pitch4-primary-note:      #ff9752;
			--pitch5-secondary-channel: #d020d0;
			--pitch5-primary-channel:   #FF90FF;
			--pitch5-secondary-note:    #d020d0;
			--pitch5-primary-note:      #ff90ff;
			--pitch6-secondary-channel: #552377;
			--pitch6-primary-channel:   #9f31ea;
			--pitch6-secondary-note:    #552377;
			--pitch6-primary-note:      #9f31ea;
			--pitch7-secondary-channel: #221b89;
			--pitch7-primary-channel:   #2b6aff;
			--pitch7-secondary-note:    #221b89;
			--pitch7-primary-note:      #2b6aff;
			--pitch8-secondary-channel: #00995f;
			--pitch8-primary-channel:   #00ff9f;
			--pitch8-secondary-note:    #00995f;
			--pitch8-primary-note:      #00ff9f;
			--pitch9-secondary-channel: #d6b03e;
			--pitch9-primary-channel:   #ffbf00;
			--pitch9-secondary-note:    #d6b03e;
			--pitch9-primary-note:      #ffbf00;
			--pitch10-secondary-channel:#b25915;
			--pitch10-primary-channel:  #d85d00;
			--pitch10-secondary-note:   #b25915;
			--pitch10-primary-note:     #d85d00;
			--pitch11-secondary-channel:#891a60;
			--pitch11-primary-channel:  #ff00a1;
			--pitch11-secondary-note:   #891a60;
			--pitch11-primary-note:     #ff00a1;
			--pitch12-secondary-channel:#965cbc;
			--pitch12-primary-channel:  #c26afc;
			--pitch12-secondary-note:   #965cbc;
			--pitch12-primary-note:     #c26afc;
			--noise1-secondary-channel: #991010;
			--noise1-primary-channel:   #ff1616;
			--noise1-secondary-note:    #991010;
			--noise1-primary-note:      #ff1616;
			--noise2-secondary-channel: #aaaaaa;
			--noise2-primary-channel:   #ffffff;
			--noise2-secondary-note:    #aaaaaa;
			--noise2-primary-note:      #ffffff;
			--noise3-secondary-channel: #5869BD;
			--noise3-primary-channel:   #768dfc;
			--noise3-secondary-note:    #5869BD;
			--noise3-primary-note:      #768dfc;
			--noise4-secondary-channel: #7c9b42;
			--noise4-primary-channel:   #a5ff00;
			--noise4-secondary-note:    #7c9b42;
			--noise4-primary-note:      #a5ff00;
			}
	`,
        "halloween": `
	:root {
				--page-margin: black;
				--editor-background: black;
				--hover-preview: white;
				--playhead: white;
				--primary-text: white;
				--secondary-text: #999;
				--inverted-text: black;
				--text-selection: rgba(119,68,255,0.99);
				--box-selection-fill: rgba(255,255,255,0.2);
				--loop-accent: #9e2200;
				--link-accent: #98f;
				--ui-widget-background: #363636;
				--ui-widget-focus: #777;
				--volume-icon: #9e2200;	

				--tonic: #681701;
				--pitch1-background: #754a3f;
				--pitch2-background: #754a3f;
				--pitch3-background: #754a3f;
				--pitch4-background: #754a3f;
				--pitch5-background: #754a3f;
				--pitch6-background:#754a3f;
				--fifth-note: #914300;
				--pitch8-background: #754a3f;
				--pitch9-background: #754a3f;
				--pitch10-background: #754a3f;
				--pitch11-background: #754a3f;
				--pitch-background: #444;

				--octave-scrollbar: #9e2200; 
				--scrollbar-octave: #701800;

				--pitch1-secondary-channel: #0099a1;
				--pitch1-primary-channel:   #25f3ff;
				--pitch1-secondary-note:    #0099a1;
				--pitch1-primary-note:      #25f3ff;
				--pitch2-secondary-channel: #439143;
				--pitch2-primary-channel:   #44ff44;
				--pitch2-secondary-note:    #439143;
				--pitch2-primary-note:      #44ff44;
				--pitch3-secondary-channel: #a1a100;
				--pitch3-primary-channel:   #ffff25;
				--pitch3-secondary-note:    #a1a100;
				--pitch3-primary-note:      #ffff25;
				--pitch4-secondary-channel: #c75000;
				--pitch4-primary-channel:   #ff9752;
				--pitch4-secondary-note:    #c75000;
				--pitch4-primary-note:      #ff9752;
				--pitch5-secondary-channel: #d020d0;
				--pitch5-primary-channel:   #FF90FF;
				--pitch5-secondary-note:    #d020d0;
				--pitch5-primary-note:      #ff90ff;
				--pitch6-secondary-channel: #552377;
				--pitch6-primary-channel:   #9f31ea;
				--pitch6-secondary-note:    #552377;
				--pitch6-primary-note:      #9f31ea;
				--pitch7-secondary-channel: #221b89;
				--pitch7-primary-channel:   #2b6aff;
				--pitch7-secondary-note:    #221b89;
				--pitch7-primary-note:      #2b6aff;
				--pitch8-secondary-channel: #00995f;
				--pitch8-primary-channel:   #00ff9f;
				--pitch8-secondary-note:    #00995f;
				--pitch8-primary-note:      #00ff9f;
				--pitch9-secondary-channel: #d6b03e;
				--pitch9-primary-channel:   #ffbf00;
				--pitch9-secondary-note:    #d6b03e;
				--pitch9-primary-note:      #ffbf00;
				--pitch10-secondary-channel:#b25915;
				--pitch10-primary-channel:  #d85d00;
				--pitch10-secondary-note:   #b25915;
				--pitch10-primary-note:     #d85d00;
				--pitch11-secondary-channel:#891a60;
				--pitch11-primary-channel:  #ff00a1;
				--pitch11-secondary-note:   #891a60;
				--pitch11-primary-note:     #ff00a1;
				--pitch12-secondary-channel:#965cbc;
				--pitch12-primary-channel:  #c26afc;
				--pitch12-secondary-note:   #965cbc;
				--pitch12-primary-note:     #c26afc;
				--noise1-secondary-channel: #991010;
				--noise1-primary-channel:   #ff1616;
				--noise1-secondary-note:    #991010;
				--noise1-primary-note:      #ff1616;
				--noise2-secondary-channel: #aaaaaa;
				--noise2-primary-channel:   #ffffff;
				--noise2-secondary-note:    #aaaaaa;
				--noise2-primary-note:      #ffffff;
				--noise3-secondary-channel: #5869BD;
				--noise3-primary-channel:   #768dfc;
				--noise3-secondary-note:    #5869BD;
				--noise3-primary-note:      #768dfc;
				--noise4-secondary-channel: #7c9b42;
				--noise4-primary-channel:   #a5ff00;
				--noise4-secondary-note:    #7c9b42;
				--noise4-primary-note:      #a5ff00;
			}
	`,
        "frozen": `
	:root {
				--page-margin: black;
				--editor-background: black;
				--hover-preview: white;
				--playhead: white;
				--primary-text: white;
				--secondary-text: #999;
				--inverted-text: black;
				--text-selection: rgba(119,68,255,0.99);
				--box-selection-fill: rgba(255,255,255,0.2);
				--loop-accent: #38ef17;
				--link-accent: #98f;
				--ui-widget-background: #363636;
				--ui-widget-focus: #777;
				--volume-icon: #ed2d2d;	

				--tonic: #88bce8; 
				--pitch1-background: #99c8ef; 
				--pitch2-background: #abd3f4; 
				--pitch3-background: #b8d7f2; 
				--pitch4-background: #cbe0f2;
				--pitch5-background: #e5f0f9; 
				--pitch6-background: #ffffff; 
				--fifth-note: #e5f0f9; 
				--pitch8-background: #cbe0f2; 
				--pitch9-background: #b8d7f2; 
				--pitch10-background: #abd3f4; 
				--pitch11-background: #99c8ef;
				--pitch-background: #444;

				--octave-scrollbar: #ffffff; 
				--scrollbar-octave: #ed2d2d;

				--pitch1-secondary-channel: #0099a1;
				--pitch1-primary-channel:   #25f3ff;
				--pitch1-secondary-note:    #0099a1;
				--pitch1-primary-note:      #25f3ff;
				--pitch2-secondary-channel: #439143;
				--pitch2-primary-channel:   #44ff44;
				--pitch2-secondary-note:    #439143;
				--pitch2-primary-note:      #44ff44;
				--pitch3-secondary-channel: #a1a100;
				--pitch3-primary-channel:   #ffff25;
				--pitch3-secondary-note:    #a1a100;
				--pitch3-primary-note:      #ffff25;
				--pitch4-secondary-channel: #c75000;
				--pitch4-primary-channel:   #ff9752;
				--pitch4-secondary-note:    #c75000;
				--pitch4-primary-note:      #ff9752;
				--pitch5-secondary-channel: #d020d0;
				--pitch5-primary-channel:   #FF90FF;
				--pitch5-secondary-note:    #d020d0;
				--pitch5-primary-note:      #ff90ff;
				--pitch6-secondary-channel: #552377;
				--pitch6-primary-channel:   #9f31ea;
				--pitch6-secondary-note:    #552377;
				--pitch6-primary-note:      #9f31ea;
				--pitch7-secondary-channel: #221b89;
				--pitch7-primary-channel:   #2b6aff;
				--pitch7-secondary-note:    #221b89;
				--pitch7-primary-note:      #2b6aff;
				--pitch8-secondary-channel: #00995f;
				--pitch8-primary-channel:   #00ff9f;
				--pitch8-secondary-note:    #00995f;
				--pitch8-primary-note:      #00ff9f;
				--pitch9-secondary-channel: #d6b03e;
				--pitch9-primary-channel:   #ffbf00;
				--pitch9-secondary-note:    #d6b03e;
				--pitch9-primary-note:      #ffbf00;
				--pitch10-secondary-channel:#b25915;
				--pitch10-primary-channel:  #d85d00;
				--pitch10-secondary-note:   #b25915;
				--pitch10-primary-note:     #d85d00;
				--pitch11-secondary-channel:#891a60;
				--pitch11-primary-channel:  #ff00a1;
				--pitch11-secondary-note:   #891a60;
				--pitch11-primary-note:     #ff00a1;
				--pitch12-secondary-channel:#965cbc;
				--pitch12-primary-channel:  #c26afc;
				--pitch12-secondary-note:   #965cbc;
				--pitch12-primary-note:     #c26afc;
				--noise1-secondary-channel: #991010;
				--noise1-primary-channel:   #ff1616;
				--noise1-secondary-note:    #991010;
				--noise1-primary-note:      #ff1616;
				--noise2-secondary-channel: #aaaaaa;
				--noise2-primary-channel:   #ffffff;
				--noise2-secondary-note:    #aaaaaa;
				--noise2-primary-note:      #ffffff;
				--noise3-secondary-channel: #5869BD;
				--noise3-primary-channel:   #768dfc;
				--noise3-secondary-note:    #5869BD;
				--noise3-primary-note:      #768dfc;
				--noise4-secondary-channel: #7c9b42;
				--noise4-primary-channel:   #a5ff00;
				--noise4-secondary-note:    #7c9b42;
				--noise4-primary-note:      #a5ff00;
			}
	`,
    };
    ColorConfig.pageMargin = "var(--page-margin, black)";
    ColorConfig.editorBackground = "var(--editor-background, black)";
    ColorConfig.hoverPreview = "var(--hover-preview, white)";
    ColorConfig.playhead = "var(--playhead, white)";
    ColorConfig.primaryText = "var(--primary-text, white)";
    ColorConfig.secondaryText = "var(--secondary-text, #999)";
    ColorConfig.invertedText = "var(--inverted-text, black)";
    ColorConfig.textSelection = "var(--text-selection, rgba(119,68,255,0.99))";
    ColorConfig.boxSelectionFill = "var(--box-selection-fill, rgba(255,255,255,0.2))";
    ColorConfig.loopAccent = "var(--loop-accent, #9900cc)";
    ColorConfig.linkAccent = "var(--link-accent, #98f)";
    ColorConfig.uiWidgetBackground = "var(--ui-widget-background, #444)";
    ColorConfig.uiWidgetFocus = "var(--ui-widget-focus)";
    ColorConfig.pitchBackground = "var(--pitch-background, #444)";
    ColorConfig.tonic = "var(--tonic, #864)";
    ColorConfig.fifthNote = "var(--fifth-note, #468)";
    ColorConfig.pitch1Background = "var(--pitch1-background, var(--pitch-background, #444))";
    ColorConfig.pitch2Background = "var(--pitch2-background, var(--pitch-background, #444))";
    ColorConfig.pitch3Background = "var(--pitch3-background, var(--pitch-background, #444))";
    ColorConfig.pitch4Background = "var(--pitch4-background, var(--pitch-background, #444))";
    ColorConfig.pitch5Background = "var(--pitch5-background, var(--pitch-background, #444))";
    ColorConfig.pitch6Background = "var(--pitch6-background, var(--pitch-background, #444))";
    ColorConfig.pitch8Background = "var(--pitch8-background, var(--pitch-background, #444))";
    ColorConfig.pitch9Background = "var(--pitch9-background, var(--pitch-background, #444))";
    ColorConfig.pitch10Background = "var(--pitch10-background, var(--pitch-background, #444))";
    ColorConfig.pitch11Background = "var(--pitch11-background, var(--pitch-background, #444))";
    ColorConfig.volumeIcon = "var(--volume-icon, #777777)";
    ColorConfig.octaveScrollbar = "var(--octave-scrollbar, #444444)";
    ColorConfig.scrollbarOctave = "var(--scrollbar-octave, #886644)";
    ColorConfig.channelBox = "var(--channel-box, #444444)";
    ColorConfig.blackPianoKey = "var(--black-piano-key, #444)";
    ColorConfig.whitePianoKey = "var(--white-piano-key, #bbb)";
    ColorConfig.pitchChannels = toNameMap([
        {
            name: "pitch1",
            secondaryChannel: "var(--pitch1-secondary-channel)",
            primaryChannel: "var(--pitch1-primary-channel)",
            secondaryNote: "var(--pitch1-secondary-note)",
            primaryNote: "var(--pitch1-primary-note)",
        }, {
            name: "pitch2",
            secondaryChannel: "var(--pitch2-secondary-channel)",
            primaryChannel: "var(--pitch2-primary-channel)",
            secondaryNote: "var(--pitch2-secondary-note)",
            primaryNote: "var(--pitch2-primary-note)",
        }, {
            name: "pitch3",
            secondaryChannel: "var(--pitch3-secondary-channel)",
            primaryChannel: "var(--pitch3-primary-channel)",
            secondaryNote: "var(--pitch3-secondary-note)",
            primaryNote: "var(--pitch3-primary-note)",
        }, {
            name: "pitch4",
            secondaryChannel: "var(--pitch4-secondary-channel)",
            primaryChannel: "var(--pitch4-primary-channel)",
            secondaryNote: "var(--pitch4-secondary-note)",
            primaryNote: "var(--pitch4-primary-note)",
        }, {
            name: "pitch5",
            secondaryChannel: "var(--pitch5-secondary-channel)",
            primaryChannel: "var(--pitch5-primary-channel)",
            secondaryNote: "var(--pitch5-secondary-note)",
            primaryNote: "var(--pitch5-primary-note)",
        }, {
            name: "pitch6",
            secondaryChannel: "var(--pitch6-secondary-channel)",
            primaryChannel: "var(--pitch6-primary-channel)",
            secondaryNote: "var(--pitch6-secondary-note)",
            primaryNote: "var(--pitch6-primary-note)",
        }, {
            name: "pitch7",
            secondaryChannel: "var(--pitch7-secondary-channel)",
            primaryChannel: "var(--pitch7-primary-channel)",
            secondaryNote: "var(--pitch7-secondary-note)",
            primaryNote: "var(--pitch7-primary-note)",
        }, {
            name: "pitch8",
            secondaryChannel: "var(--pitch8-secondary-channel)",
            primaryChannel: "var(--pitch8-primary-channel)",
            secondaryNote: "var(--pitch8-secondary-note)",
            primaryNote: "var(--pitch8-primary-note)",
        }, {
            name: "pitch9",
            secondaryChannel: "var(--pitch9-secondary-channel)",
            primaryChannel: "var(--pitch9-primary-channel)",
            secondaryNote: "var(--pitch9-secondary-note)",
            primaryNote: "var(--pitch9-primary-note)",
        }, {
            name: "pitch10",
            secondaryChannel: "var(--pitch10-secondary-channel)",
            primaryChannel: "var(--pitch10-primary-channel)",
            secondaryNote: "var(--pitch10-secondary-note)",
            primaryNote: "var(--pitch10-primary-note)",
        },
        {
            name: "pitch11",
            secondaryChannel: "var(--pitch11-secondary-channel)",
            primaryChannel: "var(--pitch11-primary-channel)",
            secondaryNote: "var(--pitch11-secondary-note)",
            primaryNote: "var(--pitch11-primary-note)",
        }, {
            name: "pitch12",
            secondaryChannel: "var(--pitch12-secondary-channel)",
            primaryChannel: "var(--pitch12-primary-channel)",
            secondaryNote: "var(--pitch12-secondary-note)",
            primaryNote: "var(--pitch12-primary-note)",
        },
    ]);
    ColorConfig.noiseChannels = toNameMap([
        {
            name: "noise1",
            secondaryChannel: "var(--noise1-secondary-channel)",
            primaryChannel: "var(--noise1-primary-channel)",
            secondaryNote: "var(--noise1-secondary-note)",
            primaryNote: "var(--noise1-primary-note)",
        }, {
            name: "noise2",
            secondaryChannel: "var(--noise2-secondary-channel)",
            primaryChannel: "var(--noise2-primary-channel)",
            secondaryNote: "var(--noise2-secondary-note)",
            primaryNote: "var(--noise2-primary-note)",
        }, {
            name: "noise3",
            secondaryChannel: "var(--noise3-secondary-channel)",
            primaryChannel: "var(--noise3-primary-channel)",
            secondaryNote: "var(--noise3-secondary-note)",
            primaryNote: "var(--noise3-primary-note)",
        }, {
            name: "noise4",
            secondaryChannel: "var(--noise4-secondary-channel)",
            primaryChannel: "var(--noise4-primary-channel)",
            secondaryNote: "var(--noise4-secondary-note)",
            primaryNote: "var(--noise4-primary-note)",
        },
    ]);
    ColorConfig._styleElement = document.head.appendChild(HTML.style({ type: "text/css" }));

    const { div: div$i } = HTML;
    function prettyNumber(value) {
        return value.toFixed(2).replace(/\.?0*$/, "");
    }
    function makeEmptyReplacementElement(node) {
        const clone = node.cloneNode(false);
        node.parentNode.replaceChild(clone, node);
        return clone;
    }
    class PatternCursor {
        constructor() {
            this.valid = false;
            this.prevNote = null;
            this.curNote = null;
            this.nextNote = null;
            this.pitch = 0;
            this.pitchIndex = -1;
            this.curIndex = 0;
            this.start = 0;
            this.end = 0;
            this.part = 0;
            this.notePart = 0;
            this.nearPinIndex = 0;
            this.pins = [];
        }
    }
    class PatternEditor {
        constructor(_doc) {
            this._doc = _doc;
            this._svgNoteBackground = SVG.pattern({ id: "patternEditorNoteBackground", x: "0", y: "0", width: "64", height: "156", patternUnits: "userSpaceOnUse" });
            this._svgDrumBackground = SVG.pattern({ id: "patternEditorDrumBackground", x: "0", y: "0", width: "64", height: "40", patternUnits: "userSpaceOnUse" });
            this._svgBackground = SVG.rect({ x: "0", y: "0", width: "512", height: "481", "pointer-events": "none", fill: "url(#patternEditorNoteBackground)" });
            this._svgNoteContainer = SVG.svg();
            this._svgPlayhead = SVG.rect({ id: "", x: "0", y: "0", width: "4", height: "481", fill: "white", "pointer-events": "none" });
            this._svgPreview = SVG.path({ fill: "none", stroke: "white", "stroke-width": "2", "pointer-events": "none" });
            this._svg = SVG.svg({ style: "touch-action: none; position: absolute;", width: "100%", height: "100%", viewBox: "0 0 512 481", preserveAspectRatio: "none" }, [
                SVG.defs(undefined, [
                    this._svgNoteBackground,
                    this._svgDrumBackground,
                ]),
                this._svgBackground,
                this._svgNoteContainer,
                this._svgPreview,
                this._svgPlayhead,
            ]);
            this.container = div$i({ style: "height: 100%; overflow:hidden; position: relative; flex-grow: 1;" }, [this._svg]);
            this._defaultPitchHeight = 13;
            this._defaultDrumHeight = 40;
            this._backgroundPitchRows = [];
            this._backgroundDrumRow = SVG.rect();
            this._defaultPinChannels = [
                [makeNotePin(0, 0, 3), makeNotePin(0, 2, 3)],
                [makeNotePin(0, 0, 3), makeNotePin(0, 2, 3)],
                [makeNotePin(0, 0, 3), makeNotePin(0, 2, 3)],
                [makeNotePin(0, 0, 3), makeNotePin(0, 2, 0)],
            ];
            this._editorHeight = 481;
            this._mouseX = 0;
            this._mouseY = 0;
            this._mouseDown = false;
            this._mouseOver = false;
            this._mouseDragging = false;
            this._mouseHorizontal = false;
            this._usingTouch = false;
            this._copiedPinChannels = [];
            this._mouseXStart = 0;
            this._mouseYStart = 0;
            this._mouseXPrev = 0;
            this._mouseYPrev = 0;
            this._dragTime = 0;
            this._dragPitch = 0;
            this._dragVolume = 0;
            this._dragVisible = false;
            this._dragChange = null;
            this._cursor = new PatternCursor();
            this._pattern = null;
            this._playheadX = 0.0;
            this._octaveOffset = 0;
            this._renderedWidth = -1;
            this._renderedBeatWidth = -1;
            this._renderedFifths = false;
            this._renderedACS = false;
            this._renderedPiano = false;
            this._renderedDrums = false;
            this._setKey = 1;
            this._renderedPartsPerBeat = -1;
            this._renderedPitchChannelCount = -1;
            this._renderedDrumChannelCount = -1;
            this._followPlayheadBar = -1;
            this.resetCopiedPins = () => {
                const maxDivision = this._getMaxDivision();
                this._copiedPinChannels.length = this._doc.song.getChannelCount();
                for (let i = 0; i < this._doc.song.pitchChannelCount; i++) {
                    this._copiedPinChannels[i] = [makeNotePin(0, 0, 3), makeNotePin(0, maxDivision, 3)];
                }
                for (let i = this._doc.song.pitchChannelCount; i < this._doc.song.getChannelCount(); i++) {
                    this._copiedPinChannels[i] = [makeNotePin(0, 0, 3), makeNotePin(0, maxDivision, 0)];
                }
            };
            this._animatePlayhead = (timestamp) => {
                const playheadBar = Math.floor(this._doc.synth.playhead);
                if (this._doc.synth.playing && ((this._pattern != null && this._doc.song.getPattern(this._doc.channel, Math.floor(this._doc.synth.playhead)) == this._pattern) || Math.floor(this._doc.synth.playhead) == this._doc.bar)) {
                    this._svgPlayhead.setAttribute("visibility", "visible");
                    const modPlayhead = this._doc.synth.playhead - playheadBar;
                    if (Math.abs(modPlayhead - this._playheadX) > 0.1) {
                        this._playheadX = modPlayhead;
                    }
                    else {
                        this._playheadX += (modPlayhead - this._playheadX) * 0.2;
                    }
                    this._svgPlayhead.setAttribute("x", "" + prettyNumber(this._playheadX * this._editorWidth - 2));
                }
                else {
                    this._svgPlayhead.setAttribute("visibility", "hidden");
                }
                if (this._doc.synth.playing && this._doc.prefs.autoFollow && this._followPlayheadBar != playheadBar) {
                    new ChangeChannelBar(this._doc, this._doc.channel, playheadBar);
                    this._doc.notifier.notifyWatchers();
                }
                this._followPlayheadBar = playheadBar;
                window.requestAnimationFrame(this._animatePlayhead);
            };
            this._whenMouseOver = (event) => {
                if (this._mouseOver)
                    return;
                this._mouseOver = true;
                this._usingTouch = false;
            };
            this._whenMouseOut = (event) => {
                if (!this._mouseOver)
                    return;
                this._mouseOver = false;
            };
            this._whenMousePressed = (event) => {
                event.preventDefault();
                const boundingRect = this._svg.getBoundingClientRect();
                this._mouseX = ((event.clientX || event.pageX) - boundingRect.left) * this._editorWidth / (boundingRect.right - boundingRect.left);
                this._mouseY = ((event.clientY || event.pageY) - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
                if (isNaN(this._mouseX))
                    this._mouseX = 0;
                if (isNaN(this._mouseY))
                    this._mouseY = 0;
                this._usingTouch = false;
                this._whenCursorPressed();
            };
            this._whenTouchPressed = (event) => {
                event.preventDefault();
                const boundingRect = this._svg.getBoundingClientRect();
                this._mouseX = (event.touches[0].clientX - boundingRect.left) * this._editorWidth / (boundingRect.right - boundingRect.left);
                this._mouseY = (event.touches[0].clientY - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
                if (isNaN(this._mouseX))
                    this._mouseX = 0;
                if (isNaN(this._mouseY))
                    this._mouseY = 0;
                this._usingTouch = true;
                this._whenCursorPressed();
            };
            this._whenMouseMoved = (event) => {
                const boundingRect = this._svg.getBoundingClientRect();
                this._mouseX = ((event.clientX || event.pageX) - boundingRect.left) * this._editorWidth / (boundingRect.right - boundingRect.left);
                this._mouseY = ((event.clientY || event.pageY) - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
                if (isNaN(this._mouseX))
                    this._mouseX = 0;
                if (isNaN(this._mouseY))
                    this._mouseY = 0;
                this._usingTouch = false;
                this._whenCursorMoved();
            };
            this._whenTouchMoved = (event) => {
                if (!this._mouseDown)
                    return;
                event.preventDefault();
                const boundingRect = this._svg.getBoundingClientRect();
                this._mouseX = (event.touches[0].clientX - boundingRect.left) * this._editorWidth / (boundingRect.right - boundingRect.left);
                this._mouseY = (event.touches[0].clientY - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
                if (isNaN(this._mouseX))
                    this._mouseX = 0;
                if (isNaN(this._mouseY))
                    this._mouseY = 0;
                this._whenCursorMoved();
            };
            this._whenCursorReleased = (event) => {
                if (!this._cursor.valid)
                    return;
                const continuousState = this._doc.lastChangeWas(this._dragChange);
                if (this._mouseDragging && continuousState) {
                    if (this._dragChange != null) {
                        this._doc.record(this._dragChange);
                        this._dragChange = null;
                    }
                }
                else if (this._mouseDown && continuousState) {
                    if (this._cursor.curNote == null) {
                        const note = makeNote(this._cursor.pitch, this._cursor.start, this._cursor.end, 3, this._doc.song.getChannelIsDrum(this._doc.channel));
                        note.pins = [];
                        for (const oldPin of this._cursor.pins) {
                            note.pins.push(makeNotePin(0, oldPin.time, oldPin.volume));
                        }
                        const sequence = new ChangeSequence();
                        sequence.append(new ChangeEnsurePatternExists(this._doc));
                        const pattern = this._doc.getCurrentPattern();
                        if (pattern == null)
                            throw new Error();
                        sequence.append(new ChangeNoteAdded(this._doc, pattern, note, this._cursor.curIndex));
                        this._doc.record(sequence);
                    }
                    else {
                        if (this._pattern == null)
                            throw new Error();
                        if (this._cursor.pitchIndex == -1) {
                            const sequence = new ChangeSequence();
                            if (this._cursor.curNote.pitches.length == 4) {
                                sequence.append(new ChangePitchAdded(this._doc, this._cursor.curNote, this._cursor.curNote.pitches[0], 0, true));
                            }
                            sequence.append(new ChangePitchAdded(this._doc, this._cursor.curNote, this._cursor.pitch, this._cursor.curNote.pitches.length));
                            this._doc.record(sequence);
                            this._copyPins(this._cursor.curNote);
                        }
                        else {
                            if (this._cursor.curNote.pitches.length == 1) {
                                this._doc.record(new ChangeNoteAdded(this._doc, this._pattern, this._cursor.curNote, this._cursor.curIndex, true));
                            }
                            else {
                                this._doc.record(new ChangePitchAdded(this._doc, this._cursor.curNote, this._cursor.pitch, this._cursor.curNote.pitches.indexOf(this._cursor.pitch), true));
                            }
                        }
                    }
                }
                this._mouseDown = false;
                this._mouseDragging = false;
                this._updateCursorStatus();
                this._updatePreview();
            };
            this._documentChanged = () => {
                this._editorWidth = this._doc.prefs.showLetters ? (this._doc.prefs.showScrollBar ? 460 : 480) : (this._doc.prefs.showScrollBar ? 492 : 512);
                this._pattern = this._doc.getCurrentPattern();
                this._partWidth = this._editorWidth / (this._doc.song.beatsPerBar * this._doc.song.partsPerBeat);
                this._pitchHeight = this._doc.song.getChannelIsDrum(this._doc.channel) ? this._defaultDrumHeight : this._defaultPitchHeight;
                this._pitchCount = this._doc.song.getChannelIsDrum(this._doc.channel) ? Config.drumCount : Config.pitchCount;
                this._octaveOffset = this._doc.song.channels[this._doc.channel].octave * 12;
                if (this._renderedPartsPerBeat != this._doc.song.partsPerBeat ||
                    this._renderedPitchChannelCount != this._doc.song.pitchChannelCount ||
                    this._renderedDrumChannelCount != this._doc.song.drumChannelCount) {
                    this._renderedPartsPerBeat = this._doc.song.partsPerBeat;
                    this._renderedPitchChannelCount = this._doc.song.pitchChannelCount;
                    this._renderedDrumChannelCount = this._doc.song.drumChannelCount;
                    this.resetCopiedPins();
                }
                this._copiedPins = this._copiedPinChannels[this._doc.channel];
                if (this._renderedWidth != this._editorWidth) {
                    this._renderedWidth = this._editorWidth;
                    this._svg.setAttribute("viewBox", "0 0 " + this._editorWidth + " 481");
                    this._svgBackground.setAttribute("width", "" + this._editorWidth);
                }
                const beatWidth = this._editorWidth / this._doc.song.beatsPerBar;
                if (this._renderedBeatWidth != beatWidth) {
                    this._renderedBeatWidth = beatWidth;
                    this._svgNoteBackground.setAttribute("width", "" + beatWidth);
                    this._svgDrumBackground.setAttribute("width", "" + beatWidth);
                    this._backgroundDrumRow.setAttribute("width", "" + (beatWidth - 2));
                    for (let j = 0; j < 12; j++) {
                        this._backgroundPitchRows[j].setAttribute("width", "" + (beatWidth - 2));
                    }
                }
                if (!this._mouseDown)
                    this._updateCursorStatus();
                this._svgNoteContainer = makeEmptyReplacementElement(this._svgNoteContainer);
                this._updatePreview();
                for (let j = 0; j < 12; j++) {
                    this._backgroundPitchRows[j].style.visibility = Config.scales[this._doc.song.scale].flags[j] ? "visible" : "hidden";
                }
                if (this._doc.song.getChannelIsDrum(this._doc.channel)) {
                    if (!this._renderedDrums) {
                        this._renderedDrums = true;
                        this._svgBackground.setAttribute("fill", "url(#patternEditorDrumBackground)");
                        this._svgBackground.setAttribute("height", "" + (this._defaultDrumHeight * Config.drumCount));
                    }
                }
                else {
                    if (this._renderedDrums) {
                        this._renderedDrums = false;
                        this._svgBackground.setAttribute("fill", "url(#patternEditorNoteBackground)");
                        this._svgBackground.setAttribute("height", "" + this._editorHeight);
                    }
                }
                if (this._doc.prefs.showChannels) {
                    for (let channel = this._doc.song.getChannelCount() - 1; channel >= 0; channel--) {
                        if (channel == this._doc.channel)
                            continue;
                        if (this._doc.song.getChannelIsDrum(channel) != this._doc.song.getChannelIsDrum(this._doc.channel))
                            continue;
                        const pattern2 = this._doc.song.getPattern(channel, this._doc.bar);
                        if (pattern2 == null)
                            continue;
                        for (const note of pattern2.notes) {
                            for (const pitch of note.pitches) {
                                const notePath = SVG.path();
                                notePath.setAttribute("fill", ColorConfig.getChannelColor(this._doc.song, channel).secondaryNote);
                                notePath.setAttribute("pointer-events", "none");
                                this._drawNote(notePath, pitch, note.start, note.pins, this._pitchHeight * 0.19, false, this._doc.song.channels[channel].octave * 12);
                                this._svgNoteContainer.appendChild(notePath);
                            }
                        }
                    }
                }
                if (this._pattern != null) {
                    for (const note of this._pattern.notes) {
                        for (let i = 0; i < note.pitches.length; i++) {
                            const pitch = note.pitches[i];
                            let notePath = SVG.path();
                            notePath.setAttribute("fill", ColorConfig.getChannelColor(this._doc.song, this._doc.channel).secondaryChannel);
                            notePath.setAttribute("pointer-events", "none");
                            this._drawNote(notePath, pitch, note.start, note.pins, this._pitchHeight / 2 + 1, false, this._octaveOffset);
                            this._svgNoteContainer.appendChild(notePath);
                            notePath = SVG.path();
                            notePath.setAttribute("fill", ColorConfig.getChannelColor(this._doc.song, this._doc.channel).primaryNote);
                            notePath.setAttribute("pointer-events", "none");
                            this._drawNote(notePath, pitch, note.start, note.pins, this._pitchHeight / 2 + 1, true, this._octaveOffset);
                            this._svgNoteContainer.appendChild(notePath);
                            if (note.pitches.length > 1) {
                                let oscillatorLabel = SVG.text();
                                oscillatorLabel.setAttribute("x", "" + prettyNumber(this._partWidth * note.start + 2));
                                oscillatorLabel.setAttribute("y", "" + prettyNumber(this._pitchToPixelHeight(pitch - this._octaveOffset)));
                                oscillatorLabel.setAttribute("width", "30");
                                oscillatorLabel.setAttribute("fill", "black");
                                oscillatorLabel.setAttribute("text-anchor", "start");
                                oscillatorLabel.setAttribute("dominant-baseline", "central");
                                oscillatorLabel.setAttribute("pointer-events", "none");
                                oscillatorLabel.textContent = "" + (i + 1);
                                this._svgNoteContainer.appendChild(oscillatorLabel);
                            }
                        }
                    }
                }
            };
            for (let i = 0; i < 12; i++) {
                const y = (12 - i) % 12;
                const rectangle = SVG.rect();
                rectangle.setAttribute("x", "1");
                rectangle.setAttribute("y", "" + (y * this._defaultPitchHeight + 1));
                rectangle.setAttribute("height", "" + (this._defaultPitchHeight - 2));
                rectangle.setAttribute("fill", (i == 0) ? ColorConfig.tonic : ColorConfig.uiWidgetBackground);
                this._svgNoteBackground.appendChild(rectangle);
                this._backgroundPitchRows[i] = rectangle;
            }
            this._svg.style.backgroundColor = ColorConfig.editorBackground;
            this._backgroundDrumRow.setAttribute("x", "1");
            this._backgroundDrumRow.setAttribute("y", "1");
            this._backgroundDrumRow.setAttribute("height", "" + (this._defaultDrumHeight - 2));
            this._backgroundDrumRow.setAttribute("fill", "#444444");
            this._svgDrumBackground.appendChild(this._backgroundDrumRow);
            this._doc.notifier.watch(this._documentChanged);
            this._documentChanged();
            this._updateCursorStatus();
            this._updatePreview();
            window.requestAnimationFrame(this._animatePlayhead);
            this._svg.addEventListener("mousedown", this._whenMousePressed);
            document.addEventListener("mousemove", this._whenMouseMoved);
            document.addEventListener("mouseup", this._whenCursorReleased);
            this._svg.addEventListener("mouseover", this._whenMouseOver);
            this._svg.addEventListener("mouseout", this._whenMouseOut);
            this._svg.addEventListener("touchstart", this._whenTouchPressed);
            this._svg.addEventListener("touchmove", this._whenTouchMoved);
            this._svg.addEventListener("touchend", this._whenCursorReleased);
            this._svg.addEventListener("touchcancel", this._whenCursorReleased);
            this.resetCopiedPins();
        }
        _getMaxDivision() {
            if (this._doc.song.partsPerBeat % 3 == 0) {
                return this._doc.song.partsPerBeat / 3;
            }
            else if (this._doc.song.partsPerBeat % 2 == 0) {
                return this._doc.song.partsPerBeat / 2;
            }
            return this._doc.song.partsPerBeat;
        }
        _updateCursorStatus() {
            this._cursor = new PatternCursor();
            if (this._mouseX < 0 || this._mouseX > this._editorWidth || this._mouseY < 0 || this._mouseY > this._editorHeight)
                return;
            this._cursor.part = Math.floor(Math.max(0, Math.min(this._doc.song.beatsPerBar * this._doc.song.partsPerBeat - 1, this._mouseX / this._partWidth)));
            if (this._pattern != null) {
                for (const note of this._pattern.notes) {
                    if (note.end <= this._cursor.part) {
                        this._cursor.prevNote = note;
                        this._cursor.curIndex++;
                    }
                    else if (note.start <= this._cursor.part && note.end > this._cursor.part) {
                        this._cursor.curNote = note;
                    }
                    else if (note.start > this._cursor.part) {
                        this._cursor.nextNote = note;
                        break;
                    }
                }
            }
            let mousePitch = this._findMousePitch(this._mouseY);
            if (this._cursor.curNote != null) {
                this._cursor.start = this._cursor.curNote.start;
                this._cursor.end = this._cursor.curNote.end;
                this._cursor.pins = this._cursor.curNote.pins;
                let interval = 0;
                let error = 0;
                let prevPin;
                let nextPin = this._cursor.curNote.pins[0];
                for (let j = 1; j < this._cursor.curNote.pins.length; j++) {
                    prevPin = nextPin;
                    nextPin = this._cursor.curNote.pins[j];
                    const leftSide = this._partWidth * (this._cursor.curNote.start + prevPin.time);
                    const rightSide = this._partWidth * (this._cursor.curNote.start + nextPin.time);
                    if (this._mouseX > rightSide)
                        continue;
                    if (this._mouseX < leftSide)
                        throw new Error();
                    const intervalRatio = (this._mouseX - leftSide) / (rightSide - leftSide);
                    const arc = Math.sqrt(1.0 / Math.sqrt(4.0) - Math.pow(intervalRatio - 0.5, 2.0)) - 0.5;
                    const bendHeight = Math.abs(nextPin.interval - prevPin.interval);
                    interval = prevPin.interval * (1.0 - intervalRatio) + nextPin.interval * intervalRatio;
                    error = arc * bendHeight + 1.0;
                    break;
                }
                let minInterval = Number.MAX_VALUE;
                let maxInterval = -Number.MAX_VALUE;
                let bestDistance = Number.MAX_VALUE;
                for (const pin of this._cursor.curNote.pins) {
                    if (minInterval > pin.interval)
                        minInterval = pin.interval;
                    if (maxInterval < pin.interval)
                        maxInterval = pin.interval;
                    const pinDistance = Math.abs(this._cursor.curNote.start + pin.time - this._mouseX / this._partWidth);
                    if (bestDistance > pinDistance) {
                        bestDistance = pinDistance;
                        this._cursor.nearPinIndex = this._cursor.curNote.pins.indexOf(pin);
                    }
                }
                mousePitch -= interval;
                this._cursor.pitch = this._snapToPitch(mousePitch, -minInterval, (this._doc.song.getChannelIsDrum(this._doc.channel) ? Config.drumCount - 1 : Config.maxPitch) - maxInterval);
                if (this._doc.channel != 3) {
                    let nearest = error;
                    for (let i = 0; i < this._cursor.curNote.pitches.length; i++) {
                        const distance = Math.abs(this._cursor.curNote.pitches[i] - mousePitch + 0.5);
                        if (distance > nearest)
                            continue;
                        nearest = distance;
                        this._cursor.pitch = this._cursor.curNote.pitches[i];
                    }
                }
                for (let i = 0; i < this._cursor.curNote.pitches.length; i++) {
                    if (this._cursor.curNote.pitches[i] == this._cursor.pitch) {
                        this._cursor.pitchIndex = i;
                        break;
                    }
                }
            }
            else {
                this._cursor.pitch = this._snapToPitch(mousePitch, 0, Config.maxPitch);
                const defaultLength = this._copiedPins[this._copiedPins.length - 1].time;
                const fullBeats = Math.floor(this._cursor.part / this._doc.song.partsPerBeat);
                const maxDivision = this._getMaxDivision();
                const modMouse = this._cursor.part % this._doc.song.partsPerBeat;
                if (defaultLength == 1) {
                    this._cursor.start = this._cursor.part;
                }
                else if (defaultLength > this._doc.song.partsPerBeat) {
                    this._cursor.start = fullBeats * this._doc.song.partsPerBeat;
                }
                else if (defaultLength == this._doc.song.partsPerBeat) {
                    this._cursor.start = fullBeats * this._doc.song.partsPerBeat;
                    if (maxDivision < this._doc.song.partsPerBeat && modMouse > maxDivision) {
                        this._cursor.start += Math.floor(modMouse / maxDivision) * maxDivision;
                    }
                }
                else {
                    this._cursor.start = fullBeats * this._doc.song.partsPerBeat;
                    let division = this._doc.song.partsPerBeat % defaultLength == 0 ? defaultLength : Math.min(defaultLength, maxDivision);
                    while (division < maxDivision && this._doc.song.partsPerBeat % division != 0) {
                        division++;
                    }
                    this._cursor.start += Math.floor(modMouse / division) * division;
                }
                this._cursor.end = this._cursor.start + defaultLength;
                let forceStart = 0;
                let forceEnd = this._doc.song.beatsPerBar * this._doc.song.partsPerBeat;
                if (this._cursor.prevNote != null) {
                    forceStart = this._cursor.prevNote.end;
                }
                if (this._cursor.nextNote != null) {
                    forceEnd = this._cursor.nextNote.start;
                }
                if (this._cursor.start < forceStart) {
                    this._cursor.start = forceStart;
                    this._cursor.end = this._cursor.start + defaultLength;
                    if (this._cursor.end > forceEnd) {
                        this._cursor.end = forceEnd;
                    }
                }
                else if (this._cursor.end > forceEnd) {
                    this._cursor.end = forceEnd;
                    this._cursor.start = this._cursor.end - defaultLength;
                    if (this._cursor.start < forceStart) {
                        this._cursor.start = forceStart;
                    }
                }
                if (this._cursor.end - this._cursor.start == defaultLength) {
                    this._cursor.pins = this._copiedPins;
                }
                else {
                    this._cursor.pins = [];
                    for (const oldPin of this._copiedPins) {
                        if (oldPin.time <= this._cursor.end - this._cursor.start) {
                            this._cursor.pins.push(makeNotePin(0, oldPin.time, oldPin.volume));
                            if (oldPin.time == this._cursor.end - this._cursor.start)
                                break;
                        }
                        else {
                            this._cursor.pins.push(makeNotePin(0, this._cursor.end - this._cursor.start, oldPin.volume));
                            break;
                        }
                    }
                }
            }
            this._cursor.valid = true;
        }
        _findMousePitch(pixelY) {
            return Math.max(0, Math.min(this._pitchCount - 1, this._pitchCount - (pixelY / this._pitchHeight))) + this._octaveOffset;
        }
        _snapToPitch(guess, min, max) {
            if (guess < min)
                guess = min;
            if (guess > max)
                guess = max;
            const scale = Config.scales[this._doc.song.scale].flags;
            if (scale[Math.floor(guess) % 12] || this._doc.song.getChannelIsDrum(this._doc.channel)) {
                return Math.floor(guess);
            }
            else {
                let topPitch = Math.floor(guess) + 1;
                let bottomPitch = Math.floor(guess) - 1;
                while (!scale[topPitch % 12]) {
                    topPitch++;
                }
                while (!scale[(bottomPitch) % 12]) {
                    bottomPitch--;
                }
                if (topPitch > max) {
                    if (bottomPitch < min) {
                        return min;
                    }
                    else {
                        return bottomPitch;
                    }
                }
                else if (bottomPitch < min) {
                    return topPitch;
                }
                let topRange = topPitch;
                let bottomRange = bottomPitch + 1;
                if (topPitch % 12 == 0 || topPitch % 12 == 7) {
                    topRange -= 0.5;
                }
                if (bottomPitch % 12 == 0 || bottomPitch % 12 == 7) {
                    bottomRange += 0.5;
                }
                return guess - bottomRange > topRange - guess ? topPitch : bottomPitch;
            }
        }
        _copyPins(note) {
            this._copiedPins = [];
            for (const oldPin of note.pins) {
                this._copiedPins.push(makeNotePin(0, oldPin.time, oldPin.volume));
            }
            for (let i = 1; i < this._copiedPins.length - 1;) {
                if (this._copiedPins[i - 1].volume == this._copiedPins[i].volume &&
                    this._copiedPins[i].volume == this._copiedPins[i + 1].volume) {
                    this._copiedPins.splice(i, 1);
                }
                else {
                    i++;
                }
            }
            this._copiedPinChannels[this._doc.channel] = this._copiedPins;
        }
        _whenCursorPressed() {
            this._mouseDown = true;
            this._mouseXStart = this._mouseX;
            this._mouseYStart = this._mouseY;
            this._mouseXPrev = this._mouseX;
            this._mouseYPrev = this._mouseY;
            this._updateCursorStatus();
            this._updatePreview();
            this._dragChange = new ChangeSequence();
            this._doc.setProspectiveChange(this._dragChange);
        }
        _whenCursorMoved() {
            let start;
            let end;
            const continuousState = this._doc.lastChangeWas(this._dragChange);
            if (this._mouseDown && this._cursor.valid && continuousState) {
                if (!this._mouseDragging) {
                    const dx = this._mouseX - this._mouseXStart;
                    const dy = this._mouseY - this._mouseYStart;
                    if (Math.sqrt(dx * dx + dy * dy) > 5) {
                        this._mouseDragging = true;
                        this._mouseHorizontal = Math.abs(dx) >= Math.abs(dy);
                    }
                }
                if (this._mouseDragging) {
                    if (this._dragChange != null) {
                        this._dragChange.undo();
                    }
                    const currentPart = Math.floor(this._mouseX / this._partWidth);
                    const sequence = new ChangeSequence();
                    this._dragChange = sequence;
                    this._doc.setProspectiveChange(this._dragChange);
                    if (this._cursor.curNote == null) {
                        let backwards;
                        let directLength;
                        if (currentPart < this._cursor.start) {
                            backwards = true;
                            directLength = this._cursor.start - currentPart;
                        }
                        else {
                            backwards = false;
                            directLength = currentPart - this._cursor.start + 1;
                        }
                        let defaultLength = 1;
                        for (let i = 0; i <= this._doc.song.beatsPerBar * this._doc.song.partsPerBeat; i++) {
                            if (i >= 5 &&
                                i % this._doc.song.partsPerBeat != 0 &&
                                i != this._doc.song.partsPerBeat * 3.0 / 2.0 &&
                                i != this._doc.song.partsPerBeat * 4.0 / 3.0 &&
                                i != this._doc.song.partsPerBeat * 5.0 / 3.0) {
                                continue;
                            }
                            const blessedLength = i;
                            if (blessedLength == directLength) {
                                defaultLength = blessedLength;
                                break;
                            }
                            if (blessedLength < directLength) {
                                defaultLength = blessedLength;
                            }
                            if (blessedLength > directLength) {
                                if (defaultLength < directLength - 1) {
                                    defaultLength = blessedLength;
                                }
                                break;
                            }
                        }
                        if (backwards) {
                            end = this._cursor.start;
                            start = end - defaultLength;
                        }
                        else {
                            start = this._cursor.start;
                            end = start + defaultLength;
                        }
                        if (start < 0)
                            start = 0;
                        if (end > this._doc.song.beatsPerBar * this._doc.song.partsPerBeat)
                            end = this._doc.song.beatsPerBar * this._doc.song.partsPerBeat;
                        if (start < end) {
                            sequence.append(new ChangeEnsurePatternExists(this._doc));
                            const pattern = this._doc.getCurrentPattern();
                            if (pattern == null)
                                throw new Error();
                            sequence.append(new ChangeNoteTruncate(this._doc, pattern, start, end));
                            let i;
                            for (i = 0; i < pattern.notes.length; i++) {
                                if (pattern.notes[i].start >= end)
                                    break;
                            }
                            const theNote = makeNote(this._cursor.pitch, start, end, 3, this._doc.song.getChannelIsDrum(this._doc.channel));
                            sequence.append(new ChangeNoteAdded(this._doc, pattern, theNote, i));
                            this._copyPins(theNote);
                            this._dragTime = backwards ? start : end;
                            this._dragPitch = this._cursor.pitch;
                            this._dragVolume = theNote.pins[backwards ? 0 : 1].volume;
                            this._dragVisible = true;
                        }
                        this._pattern = this._doc.getCurrentPattern();
                    }
                    else if (this._mouseHorizontal) {
                        const shift = Math.round((this._mouseX - this._mouseXStart) / this._partWidth);
                        const shiftedPin = this._cursor.curNote.pins[this._cursor.nearPinIndex];
                        let shiftedTime = this._cursor.curNote.start + shiftedPin.time + shift;
                        if (shiftedTime < 0)
                            shiftedTime = 0;
                        if (shiftedTime > this._doc.song.beatsPerBar * this._doc.song.partsPerBeat)
                            shiftedTime = this._doc.song.beatsPerBar * this._doc.song.partsPerBeat;
                        if (this._pattern == null)
                            throw new Error();
                        if (shiftedTime <= this._cursor.curNote.start && this._cursor.nearPinIndex == this._cursor.curNote.pins.length - 1 ||
                            shiftedTime >= this._cursor.curNote.end && this._cursor.nearPinIndex == 0) {
                            sequence.append(new ChangeNoteAdded(this._doc, this._pattern, this._cursor.curNote, this._cursor.curIndex, true));
                            this._dragVisible = false;
                        }
                        else {
                            start = Math.min(this._cursor.curNote.start, shiftedTime);
                            end = Math.max(this._cursor.curNote.end, shiftedTime);
                            this._dragTime = shiftedTime;
                            this._dragPitch = this._cursor.curNote.pitches[this._cursor.pitchIndex == -1 ? 0 : this._cursor.pitchIndex] + this._cursor.curNote.pins[this._cursor.nearPinIndex].interval;
                            this._dragVolume = this._cursor.curNote.pins[this._cursor.nearPinIndex].volume;
                            this._dragVisible = true;
                            if (this._pattern == null)
                                throw new Error();
                            sequence.append(new ChangeNoteTruncate(this._doc, this._pattern, start, end, this._cursor.curNote));
                            sequence.append(new ChangePinTime(this._doc, this._cursor.curNote, this._cursor.nearPinIndex, shiftedTime));
                            this._copyPins(this._cursor.curNote);
                        }
                    }
                    else if (this._cursor.pitchIndex == -1) {
                        const bendPart = Math.round(Math.max(this._cursor.curNote.start, Math.min(this._cursor.curNote.end, this._mouseX / this._partWidth))) - this._cursor.curNote.start;
                        let prevPin;
                        let nextPin = this._cursor.curNote.pins[0];
                        let bendVolume = 0;
                        let bendInterval = 0;
                        for (let i = 1; i < this._cursor.curNote.pins.length; i++) {
                            prevPin = nextPin;
                            nextPin = this._cursor.curNote.pins[i];
                            if (bendPart > nextPin.time)
                                continue;
                            if (bendPart < prevPin.time)
                                throw new Error();
                            const volumeRatio = (bendPart - prevPin.time) / (nextPin.time - prevPin.time);
                            bendVolume = Math.round(prevPin.volume * (1.0 - volumeRatio) + nextPin.volume * volumeRatio + ((this._mouseYStart - this._mouseY) / 20.0));
                            if (bendVolume < 0)
                                bendVolume = 0;
                            if (bendVolume > 3)
                                bendVolume = 3;
                            bendInterval = this._snapToPitch(prevPin.interval * (1.0 - volumeRatio) + nextPin.interval * volumeRatio + this._cursor.curNote.pitches[0], 0, Config.maxPitch) - this._cursor.curNote.pitches[0];
                            break;
                        }
                        this._dragTime = this._cursor.curNote.start + bendPart;
                        this._dragPitch = this._cursor.curNote.pitches[this._cursor.pitchIndex == -1 ? 0 : this._cursor.pitchIndex] + bendInterval;
                        this._dragVolume = bendVolume;
                        this._dragVisible = true;
                        sequence.append(new ChangeVolumeBend(this._doc, this._cursor.curNote, bendPart, bendVolume, bendInterval));
                        this._copyPins(this._cursor.curNote);
                    }
                    else {
                        this._dragVolume = this._cursor.curNote.pins[this._cursor.nearPinIndex].volume;
                        if (this._pattern == null)
                            throw new Error();
                        let bendStart;
                        let bendEnd;
                        if (this._mouseX >= this._mouseXStart) {
                            bendStart = this._cursor.part;
                            bendEnd = currentPart + 1;
                        }
                        else {
                            bendStart = this._cursor.part + 1;
                            bendEnd = currentPart;
                        }
                        if (bendEnd < 0)
                            bendEnd = 0;
                        if (bendEnd > this._doc.song.beatsPerBar * this._doc.song.partsPerBeat)
                            bendEnd = this._doc.song.beatsPerBar * this._doc.song.partsPerBeat;
                        if (bendEnd > this._cursor.curNote.end) {
                            sequence.append(new ChangeNoteTruncate(this._doc, this._pattern, this._cursor.curNote.start, bendEnd, this._cursor.curNote));
                        }
                        if (bendEnd < this._cursor.curNote.start) {
                            sequence.append(new ChangeNoteTruncate(this._doc, this._pattern, bendEnd, this._cursor.curNote.end, this._cursor.curNote));
                        }
                        let minPitch = Number.MAX_VALUE;
                        let maxPitch = -Number.MAX_VALUE;
                        for (const pitch of this._cursor.curNote.pitches) {
                            if (minPitch > pitch)
                                minPitch = pitch;
                            if (maxPitch < pitch)
                                maxPitch = pitch;
                        }
                        minPitch -= this._cursor.curNote.pitches[this._cursor.pitchIndex];
                        maxPitch -= this._cursor.curNote.pitches[this._cursor.pitchIndex];
                        const bendTo = this._snapToPitch(this._findMousePitch(this._mouseY), -minPitch, (this._doc.song.getChannelIsDrum(this._doc.channel) ? Config.drumCount - 1 : Config.maxPitch) - maxPitch);
                        sequence.append(new ChangePitchBend(this._doc, this._cursor.curNote, bendStart, bendEnd, bendTo, this._cursor.pitchIndex));
                        this._copyPins(this._cursor.curNote);
                        this._dragTime = bendEnd;
                        this._dragPitch = bendTo;
                        this._dragVisible = true;
                    }
                }
                this._mouseXPrev = this._mouseX;
                this._mouseYPrev = this._mouseY;
            }
            else {
                this._updateCursorStatus();
                this._updatePreview();
            }
        }
        _updatePreview() {
            if (this._usingTouch) {
                if (!this._mouseDown || !this._cursor.valid || !this._mouseDragging || !this._dragVisible) {
                    this._svgPreview.setAttribute("visibility", "hidden");
                }
                else {
                    this._svgPreview.setAttribute("visibility", "visible");
                    const x = this._partWidth * this._dragTime;
                    const y = this._pitchToPixelHeight(this._dragPitch - this._octaveOffset);
                    const radius = this._pitchHeight / 2;
                    const width = 80;
                    const height = 60;
                    let pathString = "";
                    pathString += "M " + prettyNumber(x) + " " + prettyNumber(y - radius * (this._dragVolume / 3.0)) + " ";
                    pathString += "L " + prettyNumber(x) + " " + prettyNumber(y - radius * (this._dragVolume / 3.0) - height) + " ";
                    pathString += "M " + prettyNumber(x) + " " + prettyNumber(y + radius * (this._dragVolume / 3.0)) + " ";
                    pathString += "L " + prettyNumber(x) + " " + prettyNumber(y + radius * (this._dragVolume / 3.0) + height) + " ";
                    pathString += "M " + prettyNumber(x) + " " + prettyNumber(y - radius * (this._dragVolume / 3.0)) + " ";
                    pathString += "L " + prettyNumber(x + width) + " " + prettyNumber(y - radius * (this._dragVolume / 3.0)) + " ";
                    pathString += "M " + prettyNumber(x) + " " + prettyNumber(y + radius * (this._dragVolume / 3.0)) + " ";
                    pathString += "L " + prettyNumber(x + width) + " " + prettyNumber(y + radius * (this._dragVolume / 3.0)) + " ";
                    pathString += "M " + prettyNumber(x) + " " + prettyNumber(y - radius * (this._dragVolume / 3.0)) + " ";
                    pathString += "L " + prettyNumber(x - width) + " " + prettyNumber(y - radius * (this._dragVolume / 3.0)) + " ";
                    pathString += "M " + prettyNumber(x) + " " + prettyNumber(y + radius * (this._dragVolume / 3.0)) + " ";
                    pathString += "L " + prettyNumber(x - width) + " " + prettyNumber(y + radius * (this._dragVolume / 3.0)) + " ";
                    this._svgPreview.setAttribute("d", pathString);
                }
            }
            else {
                if (!this._mouseOver || this._mouseDown || !this._cursor.valid) {
                    this._svgPreview.setAttribute("visibility", "hidden");
                }
                else {
                    this._svgPreview.setAttribute("visibility", "visible");
                    this._drawNote(this._svgPreview, this._cursor.pitch, this._cursor.start, this._cursor.pins, this._pitchHeight / 2 + 1, true, this._octaveOffset);
                }
            }
        }
        render() {
            if (this._doc.prefs.showMore == false) {
                if (this._renderedFifths != this._doc.prefs.showFifth) {
                    this._renderedFifths = this._doc.prefs.showFifth;
                    this._backgroundPitchRows[7].setAttribute("fill", this._doc.prefs.showFifth ? ColorConfig.fifthNote : ColorConfig.pitchBackground);
                }
                if (this._renderedPiano == true) {
                    this._renderedPiano = false;
                }
                if (this._renderedACS != this._doc.prefs.showMore) {
                    this._backgroundPitchRows[0].setAttribute("fill", ColorConfig.tonic);
                    this._backgroundPitchRows[1].setAttribute("fill", this._doc.prefs.showMore ? ColorConfig.pitch1Background : ColorConfig.pitchBackground);
                    this._backgroundPitchRows[2].setAttribute("fill", this._doc.prefs.showMore ? ColorConfig.pitch2Background : ColorConfig.pitchBackground);
                    this._backgroundPitchRows[3].setAttribute("fill", this._doc.prefs.showMore ? ColorConfig.pitch3Background : ColorConfig.pitchBackground);
                    this._backgroundPitchRows[4].setAttribute("fill", this._doc.prefs.showMore ? ColorConfig.pitch4Background : ColorConfig.pitchBackground);
                    this._backgroundPitchRows[5].setAttribute("fill", this._doc.prefs.showMore ? ColorConfig.pitch5Background : ColorConfig.pitchBackground);
                    this._backgroundPitchRows[6].setAttribute("fill", this._doc.prefs.showMore ? ColorConfig.pitch6Background : ColorConfig.pitchBackground);
                    this._backgroundPitchRows[7].setAttribute("fill", this._doc.prefs.showFifth ? ColorConfig.fifthNote : ColorConfig.pitchBackground);
                    this._backgroundPitchRows[8].setAttribute("fill", this._doc.prefs.showMore ? ColorConfig.pitch8Background : ColorConfig.pitchBackground);
                    this._backgroundPitchRows[9].setAttribute("fill", this._doc.prefs.showMore ? ColorConfig.pitch9Background : ColorConfig.pitchBackground);
                    this._backgroundPitchRows[10].setAttribute("fill", this._doc.prefs.showMore ? ColorConfig.pitch10Background : ColorConfig.pitchBackground);
                    this._backgroundPitchRows[11].setAttribute("fill", this._doc.prefs.showMore ? ColorConfig.pitch11Background : ColorConfig.pitchBackground);
                    this._renderedACS = this._doc.prefs.showMore;
                    console.log("this._renderedACS (acs disabled): " + this._renderedACS);
                }
                this._setKey = -1;
            }
            else {
                if (ColorConfig.usesPianoScheme == false) {
                    if (this._renderedACS != this._doc.prefs.showMore || this._renderedPiano == true) {
                        this._backgroundPitchRows[0].setAttribute("fill", this._doc.prefs.showMore ? ColorConfig.tonic : ColorConfig.tonic);
                        this._backgroundPitchRows[1].setAttribute("fill", this._doc.prefs.showMore ? ColorConfig.pitch1Background : ColorConfig.pitchBackground);
                        this._backgroundPitchRows[2].setAttribute("fill", this._doc.prefs.showMore ? ColorConfig.pitch2Background : ColorConfig.pitchBackground);
                        this._backgroundPitchRows[3].setAttribute("fill", this._doc.prefs.showMore ? ColorConfig.pitch3Background : ColorConfig.pitchBackground);
                        this._backgroundPitchRows[4].setAttribute("fill", this._doc.prefs.showMore ? ColorConfig.pitch4Background : ColorConfig.pitchBackground);
                        this._backgroundPitchRows[5].setAttribute("fill", this._doc.prefs.showMore ? ColorConfig.pitch5Background : ColorConfig.pitchBackground);
                        this._backgroundPitchRows[6].setAttribute("fill", this._doc.prefs.showMore ? ColorConfig.pitch6Background : ColorConfig.pitchBackground);
                        this._backgroundPitchRows[7].setAttribute("fill", this._doc.prefs.showFifth ? ColorConfig.fifthNote : ColorConfig.pitchBackground);
                        this._backgroundPitchRows[8].setAttribute("fill", this._doc.prefs.showMore ? ColorConfig.pitch8Background : ColorConfig.pitchBackground);
                        this._backgroundPitchRows[9].setAttribute("fill", this._doc.prefs.showMore ? ColorConfig.pitch9Background : ColorConfig.pitchBackground);
                        this._backgroundPitchRows[10].setAttribute("fill", this._doc.prefs.showMore ? ColorConfig.pitch10Background : ColorConfig.pitchBackground);
                        this._backgroundPitchRows[11].setAttribute("fill", this._doc.prefs.showMore ? ColorConfig.pitch11Background : ColorConfig.pitchBackground);
                        this._renderedACS = this._doc.prefs.showMore;
                        console.log("this._renderedACS (acs enabled): " + this._renderedACS);
                    }
                    if (this._renderedPiano == true) {
                        this._renderedPiano = false;
                        this._setKey = -1;
                        console.log("this._renderedACS (disabiling piano): " + this._renderedACS);
                    }
                }
                else {
                    if (this._setKey != this._doc.song.key) {
                        this._setKey = this._doc.song.key;
                        this._renderedPiano = true;
                        console.log("piano key" + this._setKey);
                        if ((this._setKey == 0) || (this._setKey == 2) || (this._setKey == 4) || (this._setKey == 6) || (this._setKey == 7) || (this._setKey == 9) || (this._setKey == 11)) {
                            this._backgroundPitchRows[0].setAttribute("fill", this._doc.prefs.showMore ? "var(--white-tonic, var(--pitch-white-key, var(--pitch-background)))" : ColorConfig.pitchBackground);
                        }
                        else {
                            this._backgroundPitchRows[0].setAttribute("fill", this._doc.prefs.showMore ? "var(--black-tonic, var(--pitch-black-key, var(--pitch-background))" : ColorConfig.pitchBackground);
                        }
                        if ((this._setKey == 0) || (this._setKey == 1) || (this._setKey == 3) || (this._setKey == 5) || (this._setKey == 7) || (this._setKey == 8) || (this._setKey == 10)) {
                            this._backgroundPitchRows[1].setAttribute("fill", this._doc.prefs.showMore ? "var(--pitch-white-key, var(--pitch-background))" : ColorConfig.pitchBackground);
                        }
                        else {
                            this._backgroundPitchRows[1].setAttribute("fill", this._doc.prefs.showMore ? "var(--pitch-black-key, var(--pitch-background))" : ColorConfig.pitchBackground);
                        }
                        if ((this._setKey == 1) || (this._setKey == 2) || (this._setKey == 4) || (this._setKey == 6) || (this._setKey == 8) || (this._setKey == 9) || (this._setKey == 11)) {
                            this._backgroundPitchRows[2].setAttribute("fill", this._doc.prefs.showMore ? "var(--pitch-white-key, var(--pitch-background))" : ColorConfig.pitchBackground);
                        }
                        else {
                            this._backgroundPitchRows[2].setAttribute("fill", this._doc.prefs.showMore ? "var(--pitch-black-key, var(--pitch-background))" : ColorConfig.pitchBackground);
                        }
                        if ((this._setKey == 0) || (this._setKey == 2) || (this._setKey == 3) || (this._setKey == 5) || (this._setKey == 7) || (this._setKey == 9) || (this._setKey == 10)) {
                            this._backgroundPitchRows[3].setAttribute("fill", this._doc.prefs.showMore ? "var(--pitch-white-key, var(--pitch-background))" : ColorConfig.pitchBackground);
                        }
                        else {
                            this._backgroundPitchRows[3].setAttribute("fill", this._doc.prefs.showMore ? "var(--pitch-black-key, var(--pitch-background))" : ColorConfig.pitchBackground);
                        }
                        if ((this._setKey == 1) || (this._setKey == 3) || (this._setKey == 4) || (this._setKey == 6) || (this._setKey == 8) || (this._setKey == 10) || (this._setKey == 11)) {
                            this._backgroundPitchRows[4].setAttribute("fill", this._doc.prefs.showMore ? " var(--pitch-white-key, var(--pitch-background))" : ColorConfig.pitchBackground);
                        }
                        else {
                            this._backgroundPitchRows[4].setAttribute("fill", this._doc.prefs.showMore ? " var(--pitch-black-key, var(--pitch-background))" : ColorConfig.pitchBackground);
                        }
                        if ((this._setKey == 0) || (this._setKey == 2) || (this._setKey == 4) || (this._setKey == 5) || (this._setKey == 7) || (this._setKey == 9) || (this._setKey == 11)) {
                            this._backgroundPitchRows[5].setAttribute("fill", this._doc.prefs.showMore ? "var(--pitch-white-key, var(--pitch-background))" : ColorConfig.pitchBackground);
                        }
                        else {
                            this._backgroundPitchRows[5].setAttribute("fill", this._doc.prefs.showMore ? "var(--pitch-black-key, var(--pitch-background))" : ColorConfig.pitchBackground);
                        }
                        if ((this._setKey == 0) || (this._setKey == 1) || (this._setKey == 3) || (this._setKey == 5) || (this._setKey == 6) || (this._setKey == 8) || (this._setKey == 10)) {
                            this._backgroundPitchRows[6].setAttribute("fill", this._doc.prefs.showMore ? "var(--pitch-white-key, var(--pitch-background))" : ColorConfig.pitchBackground);
                        }
                        else {
                            this._backgroundPitchRows[6].setAttribute("fill", this._doc.prefs.showMore ? "var(--pitch-black-key, var(--pitch-background))" : ColorConfig.pitchBackground);
                        }
                        if ((this._setKey == 1) || (this._setKey == 2) || (this._setKey == 4) || (this._setKey == 6) || (this._setKey == 7) || (this._setKey == 9) || (this._setKey == 11)) {
                            if (this._doc.prefs.showFifth == true) {
                                this._backgroundPitchRows[7].setAttribute("fill", this._doc.prefs.showMore ? "var(--white-fifth-note, var(--pitch-white-key, var(--pitch-background)))" : ColorConfig.pitchBackground);
                            }
                            else {
                                this._backgroundPitchRows[7].setAttribute("fill", this._doc.prefs.showMore ? " var(--pitch-white-key, var(--pitch-background))" : ColorConfig.pitchBackground);
                            }
                        }
                        else {
                            if (this._doc.prefs.showFifth == true) {
                                this._backgroundPitchRows[7].setAttribute("fill", this._doc.prefs.showMore ? "var(--black-fifth-note, var(--pitch-black-key, var(--pitch-background)))" : ColorConfig.pitchBackground);
                            }
                            else {
                                this._backgroundPitchRows[7].setAttribute("fill", this._doc.prefs.showMore ? "var(--pitch-black-key, var(--pitch-background))" : ColorConfig.pitchBackground);
                            }
                        }
                        if ((this._setKey == 0) || (this._setKey == 2) || (this._setKey == 3) || (this._setKey == 5) || (this._setKey == 7) || (this._setKey == 8) || (this._setKey == 10)) {
                            this._backgroundPitchRows[8].setAttribute("fill", this._doc.prefs.showMore ? "var(--pitch-white-key, var(--pitch-background))" : ColorConfig.pitchBackground);
                        }
                        else {
                            this._backgroundPitchRows[8].setAttribute("fill", this._doc.prefs.showMore ? "var(--pitch-black-key, var(--pitch-background))" : ColorConfig.pitchBackground);
                        }
                        if ((this._setKey == 1) || (this._setKey == 3) || (this._setKey == 4) || (this._setKey == 6) || (this._setKey == 8) || (this._setKey == 9) || (this._setKey == 11)) {
                            this._backgroundPitchRows[9].setAttribute("fill", this._doc.prefs.showMore ? "var(--pitch-white-key, var(--pitch-background))" : ColorConfig.pitchBackground);
                        }
                        else {
                            this._backgroundPitchRows[9].setAttribute("fill", this._doc.prefs.showMore ? "var(--pitch-black-key, var(--pitch-background))" : ColorConfig.pitchBackground);
                        }
                        if ((this._setKey == 0) || (this._setKey == 2) || (this._setKey == 4) || (this._setKey == 5) || (this._setKey == 7) || (this._setKey == 9) || (this._setKey == 10)) {
                            this._backgroundPitchRows[10].setAttribute("fill", this._doc.prefs.showMore ? "var(--pitch-white-key, var(--pitch-background))" : ColorConfig.pitchBackground);
                        }
                        else {
                            this._backgroundPitchRows[10].setAttribute("fill", this._doc.prefs.showMore ? "var(--pitch-black-key, var(--pitch-background))" : ColorConfig.pitchBackground);
                        }
                        if ((this._setKey == 1) || (this._setKey == 3) || (this._setKey == 5) || (this._setKey == 6) || (this._setKey == 8) || (this._setKey == 10) || (this._setKey == 11)) {
                            this._backgroundPitchRows[11].setAttribute("fill", this._doc.prefs.showMore ? "var(--pitch-white-key, var(--pitch-background))" : ColorConfig.pitchBackground);
                        }
                        else {
                            this._backgroundPitchRows[11].setAttribute("fill", this._doc.prefs.showMore ? "var(--pitch-black-key, var(--pitch-background))" : ColorConfig.pitchBackground);
                        }
                        if (this._renderedACS != this._doc.prefs.showMore) {
                            this._renderedACS = this._doc.prefs.showMore;
                            console.log("this._renderedACS (in piano): " + this._renderedACS);
                        }
                    }
                }
            }
        }
        _drawNote(svgElement, pitch, start, pins, radius, showVolume, offset) {
            let nextPin = pins[0];
            let pathString = "M " + prettyNumber(this._partWidth * (start + nextPin.time) + 1) + " " + prettyNumber(this._pitchToPixelHeight(pitch - offset) + radius * (showVolume ? nextPin.volume / 3.0 : 1.0)) + " ";
            for (let i = 1; i < pins.length; i++) {
                let prevPin = nextPin;
                nextPin = pins[i];
                let prevSide = this._partWidth * (start + prevPin.time) + (i == 1 ? 1 : 0);
                let nextSide = this._partWidth * (start + nextPin.time) - (i == pins.length - 1 ? 1 : 0);
                let prevHeight = this._pitchToPixelHeight(pitch + prevPin.interval - offset);
                let nextHeight = this._pitchToPixelHeight(pitch + nextPin.interval - offset);
                let prevVolume = showVolume ? prevPin.volume / 3.0 : 1.0;
                let nextVolume = showVolume ? nextPin.volume / 3.0 : 1.0;
                pathString += "L " + prettyNumber(prevSide) + " " + prettyNumber(prevHeight - radius * prevVolume) + " ";
                if (prevPin.interval > nextPin.interval)
                    pathString += "L " + prettyNumber(prevSide + 1) + " " + prettyNumber(prevHeight - radius * prevVolume) + " ";
                if (prevPin.interval < nextPin.interval)
                    pathString += "L " + prettyNumber(nextSide - 1) + " " + prettyNumber(nextHeight - radius * nextVolume) + " ";
                pathString += "L " + prettyNumber(nextSide) + " " + prettyNumber(nextHeight - radius * nextVolume) + " ";
            }
            for (let i = pins.length - 2; i >= 0; i--) {
                let prevPin = nextPin;
                nextPin = pins[i];
                let prevSide = this._partWidth * (start + prevPin.time) - (i == pins.length - 2 ? 1 : 0);
                let nextSide = this._partWidth * (start + nextPin.time) + (i == 0 ? 1 : 0);
                let prevHeight = this._pitchToPixelHeight(pitch + prevPin.interval - offset);
                let nextHeight = this._pitchToPixelHeight(pitch + nextPin.interval - offset);
                let prevVolume = showVolume ? prevPin.volume / 3.0 : 1.0;
                let nextVolume = showVolume ? nextPin.volume / 3.0 : 1.0;
                pathString += "L " + prettyNumber(prevSide) + " " + prettyNumber(prevHeight + radius * prevVolume) + " ";
                if (prevPin.interval < nextPin.interval)
                    pathString += "L " + prettyNumber(prevSide - 1) + " " + prettyNumber(prevHeight + radius * prevVolume) + " ";
                if (prevPin.interval > nextPin.interval)
                    pathString += "L " + prettyNumber(nextSide + 1) + " " + prettyNumber(nextHeight + radius * nextVolume) + " ";
                pathString += "L " + prettyNumber(nextSide) + " " + prettyNumber(nextHeight + radius * nextVolume) + " ";
            }
            pathString += "z";
            svgElement.setAttribute("d", pathString);
        }
        _pitchToPixelHeight(pitch) {
            return this._pitchHeight * (this._pitchCount - (pitch) - 0.5);
        }
    }

    const { select: select$1, div: div$h, option: option$1 } = HTML;
    class Box {
        constructor(channel, x, y, color, showVolume) {
            this._label = SVG.text({ x: 16, y: 23, "font-family": "sans-serif", "font-size": 20, "text-anchor": "middle", "font-weight": "bold", fill: ColorConfig.invertedText }, "1");
            this._rect = SVG.rect({ width: 30, height: 27, x: 1, y: 1 });
            this._vol1 = SVG.rect({ width: 6, height: 3, x: 24, y: 5 });
            this._volb = SVG.rect({ width: 6, height: 18, x: 24, y: 5 });
            this.container = SVG.svg(this._rect, this._volb, this._vol1, this._label);
            this._renderedIndex = 1;
            this._renderedDim = true;
            this._renderedSelected = false;
            this._renderedColor = "";
            this.container.setAttribute("x", "" + (x * 32));
            this.container.setAttribute("y", "" + (y * 32));
            this._rect.setAttribute("fill", "#444444");
            this._vol1.setAttribute("fill", "#444444");
            this._volb.setAttribute("fill", "#444444");
            this._label.setAttribute("fill", color);
        }
        setSquashed(squashed, y) {
            if (squashed) {
                this.container.setAttribute("y", "" + (y * 27));
                this._rect.setAttribute("height", "" + 25);
                this._vol1.setAttribute("height", "" + 2.7);
                this._volb.setAttribute("height", "" + 18);
                this._label.setAttribute("y", "" + 21);
            }
            else {
                this.container.setAttribute("y", "" + (y * 32));
                this._rect.setAttribute("height", "" + 30);
                this._vol1.setAttribute("height", "" + 3);
                this._volb.setAttribute("height", "" + 18);
                this._label.setAttribute("y", "" + 23);
            }
        }
        setIndex(index, dim, selected, y, color, volume, colorB, showVolume, mix) {
            if (mix == 2) {
                this._vol1.setAttribute("height", "" + (18 - volume * 2));
                this._vol1.setAttribute("y", "" + (5 + volume * 2));
            }
            else {
                this._vol1.setAttribute("height", "" + (18 - volume * 3.6));
                this._vol1.setAttribute("y", "" + (5 + volume * 3.6));
            }
            if (this._renderedIndex != index) {
                if (!this._renderedSelected && ((index == 0) != (this._renderedIndex == 0))) {
                    this._rect.setAttribute("fill", (index == 0) ? ColorConfig.editorBackground : ColorConfig.channelBox);
                    this._vol1.setAttribute("fill", (index == 0) ? ColorConfig.editorBackground : ColorConfig.channelBox);
                    this._volb.setAttribute("fill", (index == 0) ? ColorConfig.editorBackground : ColorConfig.channelBox);
                }
                this._renderedIndex = index;
                this._label.innerHTML = String(index);
            }
            if (this._renderedDim != dim || this._renderedColor != color) {
                this._renderedDim = dim;
                if (selected) {
                    this._label.setAttribute("fill", ColorConfig.invertedText);
                }
                else {
                    this._label.setAttribute("fill", color);
                }
            }
            if (this._renderedSelected != selected || this._renderedColor != color) {
                this._renderedSelected = selected;
                if (selected) {
                    this._rect.setAttribute("fill", color);
                    this._vol1.setAttribute("fill", color);
                    this._volb.setAttribute("fill", color);
                    this._label.setAttribute("fill", ColorConfig.invertedText);
                }
                else {
                    this._rect.setAttribute("fill", (this._renderedIndex == 0) ? ColorConfig.editorBackground : ColorConfig.channelBox);
                    this._vol1.setAttribute("fill", (this._renderedIndex == 0) ? ColorConfig.editorBackground : color);
                    this._volb.setAttribute("fill", (this._renderedIndex == 0) ? ColorConfig.editorBackground : colorB);
                    this._label.setAttribute("fill", color);
                }
            }
            if (showVolume) {
                this._label.setAttribute("x", "12");
                this._vol1.style.visibility = "visible";
                this._volb.style.visibility = "visible";
            }
            else {
                this._label.setAttribute("x", "16");
                this._vol1.style.visibility = "hidden";
                this._volb.style.visibility = "hidden";
            }
            this._renderedColor = color;
        }
    }
    class TrackEditor {
        constructor(_doc) {
            this._doc = _doc;
            this._barWidth = 32;
            this._svg = SVG.svg({ style: "position: absolute;", height: 128 });
            this._select = select$1({ class: "trackSelectBox", style: "width: 32px; height: 32px; background: none; border: none; appearance: none; color: transparent; position: absolute;" });
            this.container = div$h({ style: "height: 128px; position: relative; overflow:hidden;" }, [this._svg, this._select]);
            this._boxContainer = SVG.g();
            this._playhead = SVG.rect({ fill: "white", x: 0, y: 0, width: 4, height: 128 });
            this._boxHighlight = SVG.rect({ fill: "none", stroke: "white", "stroke-width": 2, "pointer-events": "none", x: 1, y: 1, width: 30, height: 30 });
            this._upHighlight = SVG.path({ fill: "black", stroke: "black", "stroke-width": 1, "pointer-events": "none" });
            this._downHighlight = SVG.path({ fill: "black", stroke: "black", "stroke-width": 1, "pointer-events": "none" });
            this._grid = [];
            this._mouseX = 0;
            this._mouseY = 0;
            this._pattern = null;
            this._mouseOver = false;
            this._digits = "";
            this._editorHeight = 128;
            this._channelHeight = 32;
            this._renderedChannelCount = 0;
            this._renderedBarCount = 0;
            this._renderedPatternCount = 0;
            this._renderedPlayhead = -1;
            this._renderedSquashed = false;
            this._changePattern = null;
            this._whenSelectChanged = () => {
                this._setPattern(this._select.selectedIndex);
            };
            this._animatePlayhead = (timestamp) => {
                const playhead = (this._barWidth * this._doc.synth.playhead - 2);
                if (this._renderedPlayhead != playhead) {
                    this._renderedPlayhead = playhead;
                    this._playhead.setAttribute("x", "" + playhead);
                }
                window.requestAnimationFrame(this._animatePlayhead);
            };
            this._whenMouseOver = (event) => {
                if (this._mouseOver)
                    return;
                this._mouseOver = true;
            };
            this._whenMouseOut = (event) => {
                if (!this._mouseOver)
                    return;
                this._mouseOver = false;
            };
            this._whenMousePressed = (event) => {
                event.preventDefault();
                const boundingRect = this._svg.getBoundingClientRect();
                this._mouseX = (event.clientX || event.pageX) - boundingRect.left;
                this._mouseY = (event.clientY || event.pageY) - boundingRect.top;
                const channel = Math.floor(Math.min(this._doc.song.getChannelCount() - 1, Math.max(0, this._mouseY / this._channelHeight)));
                const bar = Math.floor(Math.min(this._doc.song.barCount - 1, Math.max(0, this._mouseX / this._barWidth)));
                if (this._doc.channel == channel && this._doc.bar == bar) {
                    const up = (this._mouseY % this._channelHeight) < this._channelHeight / 2;
                    const patternCount = this._doc.song.patternsPerChannel;
                    this._setPattern((this._doc.song.channels[channel].bars[bar] + (up ? 1 : patternCount)) % (patternCount + 1));
                }
                else {
                    this._setChannelBar(channel, bar);
                }
            };
            this._whenMouseMoved = (event) => {
                const boundingRect = this._svg.getBoundingClientRect();
                this._mouseX = (event.clientX || event.pageX) - boundingRect.left;
                this._mouseY = (event.clientY || event.pageY) - boundingRect.top;
                this._updatePreview();
            };
            this._whenMouseReleased = (event) => {
            };
            this._svg.appendChild(this._boxContainer);
            this._svg.appendChild(this._boxHighlight);
            this._svg.appendChild(this._upHighlight);
            this._svg.appendChild(this._downHighlight);
            this._svg.appendChild(this._playhead);
            this._svg.style.backgroundColor = ColorConfig.editorBackground;
            window.requestAnimationFrame(this._animatePlayhead);
            this._svg.addEventListener("mousedown", this._whenMousePressed);
            document.addEventListener("mousemove", this._whenMouseMoved);
            document.addEventListener("mouseup", this._whenMouseReleased);
            this._svg.addEventListener("mouseover", this._whenMouseOver);
            this._svg.addEventListener("mouseout", this._whenMouseOut);
            this._select.addEventListener("change", this._whenSelectChanged);
        }
        _setChannelBar(channel, bar) {
            new ChangeChannelBar(this._doc, channel, bar);
            this._digits = "";
            this._doc.forgetLastChange();
        }
        _setPattern(pattern) {
            const currentValue = this._doc.song.channels[this._doc.channel].bars[this._doc.bar];
            const canReplaceLastChange = this._doc.lastChangeWas(this._changePattern);
            const oldValue = canReplaceLastChange ? this._changePattern.oldValue : currentValue;
            if (pattern != currentValue) {
                this._changePattern = new ChangePattern(this._doc, oldValue, pattern);
                this._doc.record(this._changePattern, canReplaceLastChange);
            }
        }
        _nextDigit(digit) {
            this._digits += digit;
            let parsed = parseInt(this._digits);
            if (parsed <= this._doc.song.patternsPerChannel) {
                this._setPattern(parsed);
                return;
            }
            this._digits = digit;
            parsed = parseInt(this._digits);
            if (parsed <= this._doc.song.patternsPerChannel) {
                this._setPattern(parsed);
                return;
            }
            this._digits = "";
        }
        _updatePreview() {
            let channel = Math.floor(Math.min(this._doc.song.getChannelCount() - 1, Math.max(0, this._mouseY / this._channelHeight)));
            let bar = Math.floor(Math.min(this._doc.song.barCount - 1, Math.max(0, this._mouseX / this._barWidth)));
            const wideScreen = window.innerWidth > 700;
            if (!wideScreen) {
                bar = this._doc.bar;
                channel = this._doc.channel;
            }
            const selected = (bar == this._doc.bar && channel == this._doc.channel);
            if (this._mouseOver && !selected) {
                this._boxHighlight.setAttribute("x", "" + (1 + this._barWidth * bar));
                this._boxHighlight.setAttribute("y", "" + (1 + (this._channelHeight * channel)));
                this._boxHighlight.setAttribute("height", "" + (this._channelHeight - 2));
                this._boxHighlight.style.visibility = "visible";
            }
            else {
                this._boxHighlight.style.visibility = "hidden";
            }
            if ((this._mouseOver || !wideScreen) && selected) {
                const up = (this._mouseY % this._channelHeight) < this._channelHeight / 2;
                const center = this._barWidth * (bar + 0.8);
                const middle = this._channelHeight * (channel + 0.5);
                const base = this._channelHeight * 0.1;
                const tip = this._channelHeight * 0.4;
                const width = this._channelHeight * 0.175;
                this._upHighlight.setAttribute("fill", up && wideScreen ? "#fff" : "#000");
                this._downHighlight.setAttribute("fill", !up && wideScreen ? "#fff" : "#000");
                this._upHighlight.setAttribute("d", `M ${center} ${middle - tip} L ${center + width} ${middle - base} L ${center - width} ${middle - base} z`);
                this._downHighlight.setAttribute("d", `M ${center} ${middle + tip} L ${center + width} ${middle + base} L ${center - width} ${middle + base} z`);
                this._upHighlight.style.visibility = "visible";
                this._downHighlight.style.visibility = "visible";
            }
            else {
                this._upHighlight.style.visibility = "hidden";
                this._downHighlight.style.visibility = "hidden";
            }
            this._select.style.left = (this._barWidth * this._doc.bar) + "px";
            this._select.style.top = (this._channelHeight * this._doc.channel) + "px";
            this._select.style.height = this._channelHeight + "px";
            const patternCount = this._doc.song.patternsPerChannel;
            for (let i = this._renderedPatternCount; i < patternCount; i++) {
                this._select.appendChild(option$1({ value: i }, i));
            }
            for (let i = patternCount; i < this._renderedPatternCount; i++) {
                this._select.removeChild(this._select.lastChild);
            }
            this._renderedPatternCount = patternCount;
            const selectedPattern = this._doc.song.channels[this._doc.channel].bars[this._doc.bar];
            if (this._select.selectedIndex != selectedPattern)
                this._select.selectedIndex = selectedPattern;
        }
        render() {
            this._pattern = this._doc.getCurrentPattern();
            const wideScreen = window.innerWidth > 700;
            const squashed = !wideScreen || this._doc.song.getChannelCount() > 5 || (this._doc.song.barCount > this._doc.trackVisibleBars && this._doc.song.getChannelCount() > 3);
            this._channelHeight = squashed ? 27 : 32;
            if (this._renderedChannelCount != this._doc.song.getChannelCount()) {
                for (let y = this._renderedChannelCount; y < this._doc.song.getChannelCount(); y++) {
                    this._grid[y] = [];
                    for (let x = 0; x < this._renderedBarCount; x++) {
                        const box = new Box(y, x, y, ColorConfig.getChannelColor(this._doc.song, y).secondaryChannel, this._doc.prefs.showVolumeBar);
                        box.setSquashed(squashed, y);
                        this._boxContainer.appendChild(box.container);
                        this._grid[y][x] = box;
                    }
                }
                for (let y = this._doc.song.getChannelCount(); y < this._renderedChannelCount; y++) {
                    for (let x = 0; x < this._renderedBarCount; x++) {
                        this._boxContainer.removeChild(this._grid[y][x].container);
                    }
                }
                this._grid.length = this._doc.song.getChannelCount();
            }
            if (this._renderedBarCount < this._doc.song.barCount) {
                for (let y = 0; y < this._doc.song.getChannelCount(); y++) {
                    for (let x = this._renderedBarCount; x < this._doc.song.barCount; x++) {
                        const box = new Box(y, x, y, ColorConfig.getChannelColor(this._doc.song, y).secondaryChannel, this._doc.prefs.showVolumeBar);
                        box.setSquashed(squashed, y);
                        this._boxContainer.appendChild(box.container);
                        this._grid[y][x] = box;
                    }
                    for (let x = this._doc.song.barCount; x < this._renderedBarCount; x++) {
                        this._boxContainer.removeChild(this._grid[y][x].container);
                    }
                    this._grid[y].length = this._doc.song.barCount;
                }
            }
            if (this._renderedBarCount != this._doc.song.barCount) {
                this._renderedBarCount = this._doc.song.barCount;
                const editorWidth = 32 * this._doc.song.barCount;
                this.container.style.width = editorWidth + "px";
                this._svg.setAttribute("width", editorWidth + "");
            }
            if (this._renderedSquashed != squashed) {
                for (let y = 0; y < this._doc.song.getChannelCount(); y++) {
                    for (let x = 0; x < this._renderedBarCount; x++) {
                        this._grid[y][x].setSquashed(squashed, y);
                    }
                }
            }
            if (this._renderedSquashed != squashed || this._renderedChannelCount != this._doc.song.getChannelCount()) {
                this._renderedSquashed = squashed;
                this._renderedChannelCount = this._doc.song.getChannelCount();
                this._editorHeight = this._doc.song.getChannelCount() * this._channelHeight;
                this._svg.setAttribute("height", "" + this._editorHeight);
                this._playhead.setAttribute("height", "" + this._editorHeight);
                this.container.style.height = this._editorHeight + "px";
            }
            for (let j = 0; j < this._doc.song.getChannelCount(); j++) {
                for (let i = 0; i < this._renderedBarCount; i++) {
                    const pattern = this._doc.song.getPattern(j, i);
                    const patternMute = this._doc.song.getPatternInstrumentMute(j, i);
                    const patternVolume = this._doc.song.getPatternInstrumentVolume(j, i);
                    const selected = (i == this._doc.bar && j == this._doc.channel);
                    const dim = (pattern == null || pattern.notes.length == 0);
                    const mute = patternMute == 1;
                    const volume = patternVolume;
                    const box = this._grid[j][i];
                    if (i < this._doc.song.barCount) {
                        box.setIndex(this._doc.song.channels[j].bars[i], dim, selected, j, dim && !selected && !mute ? ColorConfig.getChannelColor(this._doc.song, j).secondaryChannel : mute && !selected ? "#161616" : ColorConfig.getChannelColor(this._doc.song, j).primaryChannel, volume, dim && !selected && !mute ? ColorConfig.getChannelColor(this._doc.song, j).secondaryChannel : mute && !selected ? "#9b9b9b" : ColorConfig.getChannelColor(this._doc.song, j).secondaryChannel, this._doc.prefs.showVolumeBar, this._doc.song.mix);
                        box.container.style.visibility = "visible";
                    }
                    else {
                        box.container.style.visibility = "hidden";
                    }
                }
            }
            this._updatePreview();
        }
    }

    const { div: div$g } = HTML;
    class LoopEditor {
        constructor(_doc) {
            this._doc = _doc;
            this._barWidth = 32;
            this._editorHeight = 20;
            this._startMode = 0;
            this._endMode = 1;
            this._bothMode = 2;
            this._loop = SVG.path({ fill: "none", stroke: ColorConfig.loopAccent, "stroke-width": 4 });
            this._highlight = SVG.path({ fill: "white", "pointer-events": "none" });
            this._svg = SVG.svg({ style: "touch-action: pan-y; position: absolute;", height: this._editorHeight }, [
                this._loop,
                this._highlight,
            ]);
            this.container = div$g({ style: "height: 20px; position: relative; margin: 5px 0;" }, [this._svg]);
            this._change = null;
            this._cursor = { startBar: -1, mode: -1 };
            this._mouseX = 0;
            this._mouseY = 0;
            this._clientStartX = 0;
            this._clientStartY = 0;
            this._startedScrolling = false;
            this._draggingHorizontally = false;
            this._mouseDown = false;
            this._mouseOver = false;
            this._renderedLoopStart = -1;
            this._renderedLoopStop = -1;
            this._renderedBarCount = 0;
            this._whenMouseOver = (event) => {
                if (this._mouseOver)
                    return;
                this._mouseOver = true;
                this._updatePreview();
            };
            this._whenMouseOut = (event) => {
                if (!this._mouseOver)
                    return;
                this._mouseOver = false;
                this._updatePreview();
            };
            this._whenMousePressed = (event) => {
                event.preventDefault();
                this._mouseDown = true;
                const boundingRect = this._svg.getBoundingClientRect();
                this._mouseX = (event.clientX || event.pageX) - boundingRect.left;
                this._mouseY = (event.clientY || event.pageY) - boundingRect.top;
                this._updateCursorStatus();
                this._updatePreview();
                this._whenMouseMoved(event);
            };
            this._whenTouchPressed = (event) => {
                this._mouseDown = true;
                const boundingRect = this._svg.getBoundingClientRect();
                this._mouseX = event.touches[0].clientX - boundingRect.left;
                this._mouseY = event.touches[0].clientY - boundingRect.top;
                this._updateCursorStatus();
                this._updatePreview();
                this._clientStartX = event.touches[0].clientX;
                this._clientStartY = event.touches[0].clientY;
                this._draggingHorizontally = false;
                this._startedScrolling = false;
            };
            this._whenMouseMoved = (event) => {
                const boundingRect = this._svg.getBoundingClientRect();
                this._mouseX = (event.clientX || event.pageX) - boundingRect.left;
                this._mouseY = (event.clientY || event.pageY) - boundingRect.top;
                this._whenCursorMoved();
            };
            this._whenTouchMoved = (event) => {
                if (!this._mouseDown)
                    return;
                const boundingRect = this._svg.getBoundingClientRect();
                this._mouseX = event.touches[0].clientX - boundingRect.left;
                this._mouseY = event.touches[0].clientY - boundingRect.top;
                if (!this._draggingHorizontally && !this._startedScrolling) {
                    if (Math.abs(event.touches[0].clientY - this._clientStartY) > 10) {
                        this._startedScrolling = true;
                    }
                    else if (Math.abs(event.touches[0].clientX - this._clientStartX) > 10) {
                        this._draggingHorizontally = true;
                    }
                }
                if (this._draggingHorizontally) {
                    this._whenCursorMoved();
                    event.preventDefault();
                }
            };
            this._whenTouchReleased = (event) => {
                event.preventDefault();
                if (!this._startedScrolling) {
                    this._whenCursorMoved();
                    this._mouseOver = false;
                    this._whenCursorReleased(event);
                    this._updatePreview();
                }
            };
            this._whenCursorReleased = (event) => {
                if (this._change != null)
                    this._doc.record(this._change);
                this._change = null;
                this._mouseDown = false;
                this._updateCursorStatus();
                this._render();
            };
            this._documentChanged = () => {
                this._render();
            };
            this._updateCursorStatus();
            this._render();
            this._doc.notifier.watch(this._documentChanged);
            this._svg.style.backgroundColor = ColorConfig.editorBackground;
            this.container.addEventListener("mousedown", this._whenMousePressed);
            document.addEventListener("mousemove", this._whenMouseMoved);
            document.addEventListener("mouseup", this._whenCursorReleased);
            this.container.addEventListener("mouseover", this._whenMouseOver);
            this.container.addEventListener("mouseout", this._whenMouseOut);
            this.container.addEventListener("touchstart", this._whenTouchPressed);
            this.container.addEventListener("touchmove", this._whenTouchMoved);
            this.container.addEventListener("touchend", this._whenTouchReleased);
            this.container.addEventListener("touchcancel", this._whenTouchReleased);
        }
        _updateCursorStatus() {
            const bar = this._mouseX / this._barWidth;
            this._cursor.startBar = bar;
            if (bar > this._doc.song.loopStart - 0.25 && bar < this._doc.song.loopStart + this._doc.song.loopLength + 0.25) {
                if (bar - this._doc.song.loopStart < this._doc.song.loopLength * 0.5) {
                    this._cursor.mode = this._startMode;
                }
                else {
                    this._cursor.mode = this._endMode;
                }
            }
            else {
                this._cursor.mode = this._bothMode;
            }
        }
        _findEndPoints(middle) {
            let start = Math.round(middle - this._doc.song.loopLength / 2);
            let end = start + this._doc.song.loopLength;
            if (start < 0) {
                end -= start;
                start = 0;
            }
            if (end > this._doc.song.barCount) {
                start -= end - this._doc.song.barCount;
                end = this._doc.song.barCount;
            }
            return { start: start, length: end - start };
        }
        _whenCursorMoved() {
            if (this._mouseDown) {
                let oldStart = this._doc.song.loopStart;
                let oldEnd = this._doc.song.loopStart + this._doc.song.loopLength;
                if (this._change != null && this._doc.lastChangeWas(this._change)) {
                    oldStart = this._change.oldStart;
                    oldEnd = oldStart + this._change.oldLength;
                }
                const bar = this._mouseX / this._barWidth;
                let start;
                let end;
                let temp;
                if (this._cursor.mode == this._startMode) {
                    start = oldStart + Math.round(bar - this._cursor.startBar);
                    end = oldEnd;
                    if (start < 0)
                        start = 0;
                    if (start >= this._doc.song.barCount)
                        start = this._doc.song.barCount;
                    if (start == end) {
                        start = end - 1;
                    }
                    else if (start > end) {
                        temp = start;
                        start = end;
                        end = temp;
                    }
                    this._change = new ChangeLoop(this._doc, oldStart, oldEnd - oldStart, start, end - start);
                }
                else if (this._cursor.mode == this._endMode) {
                    start = oldStart;
                    end = oldEnd + Math.round(bar - this._cursor.startBar);
                    if (end < 0)
                        end = 0;
                    if (end >= this._doc.song.barCount)
                        end = this._doc.song.barCount;
                    if (end == start) {
                        end = start + 1;
                    }
                    else if (end < start) {
                        temp = start;
                        start = end;
                        end = temp;
                    }
                    this._change = new ChangeLoop(this._doc, oldStart, oldEnd - oldStart, start, end - start);
                }
                else if (this._cursor.mode == this._bothMode) {
                    const endPoints = this._findEndPoints(bar);
                    this._change = new ChangeLoop(this._doc, oldStart, oldEnd - oldStart, endPoints.start, endPoints.length);
                }
                this._doc.setProspectiveChange(this._change);
            }
            else {
                this._updateCursorStatus();
                this._updatePreview();
            }
        }
        _updatePreview() {
            const showHighlight = this._mouseOver && !this._mouseDown;
            this._highlight.style.visibility = showHighlight ? "visible" : "hidden";
            if (showHighlight) {
                const radius = this._editorHeight / 2;
                let highlightStart = (this._doc.song.loopStart) * this._barWidth;
                let highlightStop = (this._doc.song.loopStart + this._doc.song.loopLength) * this._barWidth;
                if (this._cursor.mode == this._startMode) {
                    highlightStop = (this._doc.song.loopStart) * this._barWidth + radius * 2;
                }
                else if (this._cursor.mode == this._endMode) {
                    highlightStart = (this._doc.song.loopStart + this._doc.song.loopLength) * this._barWidth - radius * 2;
                }
                else {
                    const endPoints = this._findEndPoints(this._cursor.startBar);
                    highlightStart = (endPoints.start) * this._barWidth;
                    highlightStop = (endPoints.start + endPoints.length) * this._barWidth;
                }
                this._highlight.setAttribute("d", `M ${highlightStart + radius} ${4} ` +
                    `L ${highlightStop - radius} ${4} ` +
                    `A ${radius - 4} ${radius - 4} ${0} ${0} ${1} ${highlightStop - radius} ${this._editorHeight - 4} ` +
                    `L ${highlightStart + radius} ${this._editorHeight - 4} ` +
                    `A ${radius - 4} ${radius - 4} ${0} ${0} ${1} ${highlightStart + radius} ${4} ` +
                    `z`);
            }
        }
        _render() {
            const radius = this._editorHeight / 2;
            const loopStart = (this._doc.song.loopStart) * this._barWidth;
            const loopStop = (this._doc.song.loopStart + this._doc.song.loopLength) * this._barWidth;
            if (this._renderedBarCount != this._doc.song.barCount) {
                this._renderedBarCount = this._doc.song.barCount;
                const editorWidth = 32 * this._doc.song.barCount;
                this.container.style.width = editorWidth + "px";
                this._svg.setAttribute("width", editorWidth + "");
            }
            if (this._renderedLoopStart != loopStart || this._renderedLoopStop != loopStop) {
                this._renderedLoopStart = loopStart;
                this._renderedLoopStop = loopStop;
                this._loop.setAttribute("d", `M ${loopStart + radius} ${2} ` +
                    `L ${loopStop - radius} ${2} ` +
                    `A ${radius - 2} ${radius - 2} ${0} ${0} ${1} ${loopStop - radius} ${this._editorHeight - 2} ` +
                    `L ${loopStart + radius} ${this._editorHeight - 2} ` +
                    `A ${radius - 2} ${radius - 2} ${0} ${0} ${1} ${loopStart + radius} ${2} ` +
                    `z`);
            }
            this._updatePreview();
        }
    }

    const { div: div$f } = HTML;
    class BarScrollBar {
        constructor(_doc, _trackContainer) {
            this._doc = _doc;
            this._trackContainer = _trackContainer;
            this._editorWidth = 512;
            this._editorHeight = 20;
            this._notches = SVG.svg({ "pointer-events": "none" });
            this._handle = SVG.rect({ fill: "#444444", x: 0, y: 2, width: 10, height: this._editorHeight - 4 });
            this._handleHighlight = SVG.rect({ fill: "none", stroke: "white", "stroke-width": 2, "pointer-events": "none", x: 0, y: 1, width: 10, height: this._editorHeight - 2 });
            this._leftHighlight = SVG.path({ fill: "white", "pointer-events": "none" });
            this._rightHighlight = SVG.path({ fill: "white", "pointer-events": "none" });
            this._svg = SVG.svg({ style: "background-color: #000000; touch-action: pan-y; position: absolute;", width: this._editorWidth, height: this._editorHeight }, [
                this._notches,
                this._handle,
                this._handleHighlight,
                this._leftHighlight,
                this._rightHighlight,
            ]);
            this.container = div$f({ class: "barScrollBar", style: "width: 512px; height: 20px; overflow: hidden; position: relative;" }, [this._svg]);
            this._mouseX = 0;
            this._mouseY = 0;
            this._mouseDown = false;
            this._mouseOver = false;
            this._dragging = false;
            this._renderedNotchCount = -1;
            this._renderedBarPos = -1;
            this._onScroll = (event) => {
                this._doc.barScrollPos = (this._trackContainer.scrollLeft / 32);
            };
            this._whenMouseOver = (event) => {
                if (this._mouseOver)
                    return;
                this._mouseOver = true;
                this._updatePreview();
            };
            this._whenMouseOut = (event) => {
                if (!this._mouseOver)
                    return;
                this._mouseOver = false;
                this._updatePreview();
            };
            this._whenMousePressed = (event) => {
                event.preventDefault();
                this._mouseDown = true;
                const boundingRect = this._svg.getBoundingClientRect();
                this._mouseX = (event.clientX || event.pageX) - boundingRect.left;
                this._mouseY = (event.clientY || event.pageY) - boundingRect.top;
                this._updatePreview();
                if (this._mouseX >= this._doc.barScrollPos * this._barWidth && this._mouseX <= (this._doc.barScrollPos + this._doc.trackVisibleBars) * this._barWidth) {
                    this._dragging = true;
                    this._dragStart = this._mouseX;
                }
            };
            this._whenTouchPressed = (event) => {
                event.preventDefault();
                this._mouseDown = true;
                const boundingRect = this._svg.getBoundingClientRect();
                this._mouseX = event.touches[0].clientX - boundingRect.left;
                this._mouseY = event.touches[0].clientY - boundingRect.top;
                this._updatePreview();
                if (this._mouseX >= this._doc.barScrollPos * this._barWidth && this._mouseX <= (this._doc.barScrollPos + this._doc.trackVisibleBars) * this._barWidth) {
                    this._dragging = true;
                    this._dragStart = this._mouseX;
                }
            };
            this._whenMouseMoved = (event) => {
                const boundingRect = this._svg.getBoundingClientRect();
                this._mouseX = (event.clientX || event.pageX) - boundingRect.left;
                this._mouseY = (event.clientY || event.pageY) - boundingRect.top;
                this._whenCursorMoved();
            };
            this._whenTouchMoved = (event) => {
                if (!this._mouseDown)
                    return;
                event.preventDefault();
                const boundingRect = this._svg.getBoundingClientRect();
                this._mouseX = event.touches[0].clientX - boundingRect.left;
                this._mouseY = event.touches[0].clientY - boundingRect.top;
                this._whenCursorMoved();
            };
            this._whenCursorReleased = (event) => {
                if (!this._dragging && this._mouseDown) {
                    if (this._mouseX < (this._doc.barScrollPos + 8) * this._barWidth) {
                        if (this._doc.barScrollPos > 0)
                            this._doc.barScrollPos--;
                        this._doc.notifier.changed();
                    }
                    else {
                        if (this._doc.barScrollPos < this._doc.song.barCount - this._doc.trackVisibleBars)
                            this._doc.barScrollPos++;
                        this._doc.notifier.changed();
                    }
                }
                this._mouseDown = false;
                this._dragging = false;
                this._updatePreview();
            };
            const center = this._editorHeight * 0.5;
            const base = 20;
            const tip = 9;
            const arrowHeight = 6;
            this._leftHighlight.setAttribute("d", `M ${tip} ${center} L ${base} ${center + arrowHeight} L ${base} ${center - arrowHeight} z`);
            this._rightHighlight.setAttribute("d", `M ${this._editorWidth - tip} ${center} L ${this._editorWidth - base} ${center + arrowHeight} L ${this._editorWidth - base} ${center - arrowHeight} z`);
            this.container.addEventListener("mousedown", this._whenMousePressed);
            document.addEventListener("mousemove", this._whenMouseMoved);
            document.addEventListener("mouseup", this._whenCursorReleased);
            this.container.addEventListener("mouseover", this._whenMouseOver);
            this.container.addEventListener("mouseout", this._whenMouseOut);
            this.container.addEventListener("touchstart", this._whenTouchPressed);
            this.container.addEventListener("touchmove", this._whenTouchMoved);
            this.container.addEventListener("touchend", this._whenCursorReleased);
            this.container.addEventListener("touchcancel", this._whenCursorReleased);
            this._trackContainer.addEventListener("scroll", this._onScroll, { capture: false, passive: true });
        }
        _whenCursorMoved() {
            if (this._dragging) {
                while (this._mouseX - this._dragStart < -this._barWidth * 0.5) {
                    if (this._doc.barScrollPos > 0) {
                        this._doc.barScrollPos--;
                        this._dragStart -= this._barWidth;
                        this._doc.notifier.changed();
                    }
                    else {
                        break;
                    }
                }
                while (this._mouseX - this._dragStart > this._barWidth * 0.5) {
                    if (this._doc.barScrollPos < this._doc.song.barCount - this._doc.trackVisibleBars) {
                        this._doc.barScrollPos++;
                        this._dragStart += this._barWidth;
                        this._doc.notifier.changed();
                    }
                    else {
                        break;
                    }
                }
            }
            if (this._mouseOver)
                this._updatePreview();
        }
        _updatePreview() {
            const showHighlight = this._mouseOver && !this._mouseDown;
            let showleftHighlight = false;
            let showRightHighlight = false;
            let showHandleHighlight = false;
            if (showHighlight) {
                if (this._mouseX < this._doc.barScrollPos * this._barWidth) {
                    showleftHighlight = true;
                }
                else if (this._mouseX > (this._doc.barScrollPos + this._doc.trackVisibleBars) * this._barWidth) {
                    showRightHighlight = true;
                }
                else {
                    showHandleHighlight = true;
                }
            }
            this._leftHighlight.style.visibility = showleftHighlight ? "visible" : "hidden";
            this._rightHighlight.style.visibility = showRightHighlight ? "visible" : "hidden";
            this._handleHighlight.style.visibility = showHandleHighlight ? "visible" : "hidden";
        }
        render() {
            this._barWidth = (this._editorWidth - 1) / Math.max(this._doc.trackVisibleBars, this._doc.song.barCount);
            const resized = this._renderedNotchCount != this._doc.song.barCount;
            if (resized) {
                this._renderedNotchCount = this._doc.song.barCount;
                while (this._notches.firstChild)
                    this._notches.removeChild(this._notches.firstChild);
                for (let i = 0; i <= this._doc.song.barCount; i++) {
                    const lineHeight = (i % 16 == 0) ? 0 : ((i % 4 == 0) ? this._editorHeight / 8 : this._editorHeight / 3);
                    this._notches.appendChild(SVG.rect({ fill: "#444444", x: i * this._barWidth - 1, y: lineHeight, width: 2, height: this._editorHeight - lineHeight * 2 }));
                }
            }
            if (resized || this._renderedBarPos != this._doc.barScrollPos) {
                this._renderedBarPos = this._doc.barScrollPos;
                this._handle.setAttribute("x", "" + (this._barWidth * this._doc.barScrollPos));
                this._handle.setAttribute("width", "" + (this._barWidth * this._doc.trackVisibleBars));
                this._handleHighlight.setAttribute("x", "" + (this._barWidth * this._doc.barScrollPos));
                this._handleHighlight.setAttribute("width", "" + (this._barWidth * this._doc.trackVisibleBars));
            }
            this._updatePreview();
            this._trackContainer.scrollLeft = this._doc.barScrollPos * 32;
        }
    }

    const { div: div$e } = HTML;
    class OctaveScrollBar {
        constructor(_doc) {
            this._doc = _doc;
            this._editorWidth = 20;
            this._editorHeight = 481;
            this._notchHeight = 4.0;
            this._octaveCount = 7;
            this._octaveHeight = (this._editorHeight - this._notchHeight) / this._octaveCount;
            this._barHeight = (this._octaveHeight * 3 + this._notchHeight);
            this._handle = SVG.rect({ fill: ColorConfig.octaveScrollbar, x: 2, y: 0, width: this._editorWidth - 4, height: this._barHeight });
            this._handleHighlight = SVG.rect({ fill: "none", stroke: "white", "stroke-width": 2, "pointer-events": "none", x: 1, y: 0, width: this._editorWidth - 2, height: this._barHeight });
            this._upHighlight = SVG.path({ fill: "white", "pointer-events": "none" });
            this._downHighlight = SVG.path({ fill: "white", "pointer-events": "none" });
            this._svg = SVG.svg({ style: "touch-action: pan-x; position: absolute;", width: this._editorWidth, height: "100%", viewBox: "0 0 20 481", preserveAspectRatio: "none" });
            this.container = div$e({ id: "octaveScrollBarContainer", style: "width: 20px; height: 100%; overflow: hidden; position: relative; flex-shrink: 0;" }, [this._svg]);
            this._mouseX = 0;
            this._mouseY = 0;
            this._mouseDown = false;
            this._mouseOver = false;
            this._dragging = false;
            this._renderedBarBottom = -1;
            this._change = null;
            this._whenMouseOver = (event) => {
                if (this._mouseOver)
                    return;
                this._mouseOver = true;
                this._updatePreview();
            };
            this._whenMouseOut = (event) => {
                if (!this._mouseOver)
                    return;
                this._mouseOver = false;
                this._updatePreview();
            };
            this._whenMousePressed = (event) => {
                event.preventDefault();
                this._mouseDown = true;
                const boundingRect = this._svg.getBoundingClientRect();
                this._mouseX = (event.clientX || event.pageX) - boundingRect.left;
                this._mouseY = ((event.clientY || event.pageY) - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
                if (isNaN(this._mouseY))
                    this._mouseY = 0;
                if (this._doc.song.getChannelIsDrum(this._doc.channel))
                    return;
                this._updatePreview();
                if (this._mouseY >= this._barBottom - this._barHeight && this._mouseY <= this._barBottom) {
                    this._dragging = true;
                    this._change = null;
                    this._dragStart = this._mouseY;
                }
            };
            this._whenTouchPressed = (event) => {
                event.preventDefault();
                this._mouseDown = true;
                const boundingRect = this._svg.getBoundingClientRect();
                this._mouseX = event.touches[0].clientX - boundingRect.left;
                this._mouseY = (event.touches[0].clientY - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
                if (isNaN(this._mouseY))
                    this._mouseY = 0;
                if (this._doc.song.getChannelIsDrum(this._doc.channel))
                    return;
                this._updatePreview();
                if (this._mouseY >= this._barBottom - this._barHeight && this._mouseY <= this._barBottom) {
                    this._dragging = true;
                    this._change = null;
                    this._dragStart = this._mouseY;
                }
            };
            this._whenMouseMoved = (event) => {
                const boundingRect = this._svg.getBoundingClientRect();
                this._mouseX = (event.clientX || event.pageX) - boundingRect.left;
                this._mouseY = ((event.clientY || event.pageY) - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
                if (isNaN(this._mouseY))
                    this._mouseY = 0;
                this._whenCursorMoved();
            };
            this._whenTouchMoved = (event) => {
                if (!this._mouseDown)
                    return;
                event.preventDefault();
                const boundingRect = this._svg.getBoundingClientRect();
                this._mouseX = event.touches[0].clientX - boundingRect.left;
                this._mouseY = (event.touches[0].clientY - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
                if (isNaN(this._mouseY))
                    this._mouseY = 0;
                this._whenCursorMoved();
            };
            this._whenCursorReleased = (event) => {
                if (!this._doc.song.getChannelIsDrum(this._doc.channel) && this._mouseDown) {
                    if (this._dragging) {
                        if (this._change != null)
                            this._doc.record(this._change);
                    }
                    else {
                        const canReplaceLastChange = this._doc.lastChangeWas(this._change);
                        const oldValue = canReplaceLastChange ? this._change.oldValue : this._doc.song.channels[this._doc.channel].octave;
                        const currentOctave = this._doc.song.channels[this._doc.channel].octave;
                        if (this._mouseY < this._barBottom - this._barHeight * 0.5) {
                            if (currentOctave < 4) {
                                this._change = new ChangeOctave(this._doc, oldValue, currentOctave + 1);
                                this._doc.record(this._change, canReplaceLastChange);
                            }
                        }
                        else {
                            if (currentOctave > 0) {
                                this._change = new ChangeOctave(this._doc, oldValue, currentOctave - 1);
                                this._doc.record(this._change, canReplaceLastChange);
                            }
                        }
                    }
                }
                this._mouseDown = false;
                this._dragging = false;
                this._updatePreview();
            };
            this._documentChanged = () => {
                this._barBottom = this._editorHeight - (this._octaveHeight * this._doc.song.channels[this._doc.channel].octave);
                this._render();
            };
            this._doc.notifier.watch(this._documentChanged);
            this._documentChanged();
            this._svg.appendChild(this._handle);
            for (let i = 0; i <= this._octaveCount; i++) {
                this._svg.appendChild(SVG.rect({ fill: ColorConfig.scrollbarOctave, x: 0, y: i * this._octaveHeight, width: this._editorWidth, height: this._notchHeight }));
            }
            this._svg.appendChild(this._handleHighlight);
            this._svg.appendChild(this._upHighlight);
            this._svg.appendChild(this._downHighlight);
            this._svg.style.backgroundColor = ColorConfig.editorBackground;
            const center = this._editorWidth * 0.5;
            const base = 20;
            const tip = 9;
            const arrowWidth = 6;
            this._upHighlight.setAttribute("d", `M ${center} ${tip} L ${center + arrowWidth} ${base} L ${center - arrowWidth} ${base} z`);
            this._downHighlight.setAttribute("d", `M ${center} ${this._editorHeight - tip} L ${center + arrowWidth} ${this._editorHeight - base} L ${center - arrowWidth} ${this._editorHeight - base} z`);
            this.container.addEventListener("mousedown", this._whenMousePressed);
            document.addEventListener("mousemove", this._whenMouseMoved);
            document.addEventListener("mouseup", this._whenCursorReleased);
            this.container.addEventListener("mouseover", this._whenMouseOver);
            this.container.addEventListener("mouseout", this._whenMouseOut);
            this.container.addEventListener("touchstart", this._whenTouchPressed);
            this.container.addEventListener("touchmove", this._whenTouchMoved);
            this.container.addEventListener("touchend", this._whenCursorReleased);
            this.container.addEventListener("touchcancel", this._whenCursorReleased);
        }
        _whenCursorMoved() {
            if (this._doc.song.getChannelIsDrum(this._doc.channel))
                return;
            if (this._dragging) {
                const currentOctave = this._doc.song.channels[this._doc.channel].octave;
                const continuingProspectiveChange = this._doc.lastChangeWas(this._change);
                const oldValue = continuingProspectiveChange ? this._change.oldValue : currentOctave;
                let octave = currentOctave;
                while (this._mouseY - this._dragStart < -this._octaveHeight * 0.5) {
                    if (octave < 4) {
                        octave++;
                        this._dragStart -= this._octaveHeight;
                    }
                    else {
                        break;
                    }
                }
                while (this._mouseY - this._dragStart > this._octaveHeight * 0.5) {
                    if (octave > 0) {
                        octave--;
                        this._dragStart += this._octaveHeight;
                    }
                    else {
                        break;
                    }
                }
                this._change = new ChangeOctave(this._doc, oldValue, octave);
                this._doc.setProspectiveChange(this._change);
            }
            if (this._mouseOver)
                this._updatePreview();
        }
        _updatePreview() {
            const showHighlight = this._mouseOver && !this._mouseDown;
            let showUpHighlight = false;
            let showDownHighlight = false;
            let showHandleHighlight = false;
            if (showHighlight) {
                if (this._mouseY < this._barBottom - this._barHeight) {
                    showUpHighlight = true;
                }
                else if (this._mouseY > this._barBottom) {
                    showDownHighlight = true;
                }
                else {
                    showHandleHighlight = true;
                }
            }
            this._upHighlight.style.visibility = showUpHighlight ? "inherit" : "hidden";
            this._downHighlight.style.visibility = showDownHighlight ? "inherit" : "hidden";
            this._handleHighlight.style.visibility = showHandleHighlight ? "inherit" : "hidden";
        }
        _render() {
            this._svg.style.visibility = (this._doc.song.getChannelIsDrum(this._doc.channel)) ? "hidden" : "visible";
            if (this._renderedBarBottom != this._barBottom) {
                this._renderedBarBottom = this._barBottom;
                this._handle.setAttribute("y", "" + (this._barBottom - this._barHeight));
                this._handleHighlight.setAttribute("y", "" + (this._barBottom - this._barHeight));
            }
            this._updatePreview();
        }
    }

    const { canvas, div: div$d } = HTML;
    class Piano {
        constructor(_doc) {
            this._doc = _doc;
            this._pianoContainer = HTML.div({ style: "width: 100%; height: 100%; display: flex; flex-direction: column-reverse; align-items: stretch;" });
            this._drumContainer = HTML.div({ style: "width: 100%; height: 100%; display: flex; flex-direction: column-reverse; align-items: stretch;" });
            this._preview = canvas({ width: "32", height: "40" });
            this.container = div$d({ style: "width: 32px; height: 100%; overflow:hidden; position: relative; flex-shrink: 0; touch-action: none;" }, [
                this._pianoContainer,
                this._drumContainer,
                this._preview,
            ]);
            this._editorHeight = 481;
            this._pianoKeys = [];
            this._pianoLabels = [];
            this._mouseX = 0;
            this._mouseY = 0;
            this._mouseDown = false;
            this._mouseOver = false;
            this._renderedScale = -1;
            this._renderedDrums = false;
            this._renderedKey = -1;
            this._renderedPitchCount = -1;
            this._renderedLiveInputPitches = [];
            this._whenMouseOver = (event) => {
                if (this._mouseOver)
                    return;
                this._mouseOver = true;
                this._updatePreview();
            };
            this._whenMouseOut = (event) => {
                if (!this._mouseOver)
                    return;
                this._mouseOver = false;
                this._updatePreview();
            };
            this._whenMouseMoved = (event) => {
                const boundingRect = this.container.getBoundingClientRect();
                this._mouseX = (event.clientX || event.pageX) - boundingRect.left;
                this._mouseY = ((event.clientY || event.pageY) - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
                if (isNaN(this._mouseY))
                    this._mouseY = 0;
                this._updateCursorPitch();
                this._doc.synth.pianoPitch[0] = this._cursorPitch + this._doc.song.channels[this._doc.channel].octave * 12;
                this._updatePreview();
            };
            this._whenMouseReleased = (event) => {
                this._mouseDown = false;
                this._doc.synth.pianoPressed = false;
                this._updatePreview();
            };
            this._whenTouchMoved = (event) => {
                event.preventDefault();
                const boundingRect = this.container.getBoundingClientRect();
                this._mouseX = event.touches[0].clientX - boundingRect.left;
                this._mouseY = (event.touches[0].clientY - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
                if (isNaN(this._mouseY))
                    this._mouseY = 0;
                this._updateCursorPitch();
                this._doc.synth.pianoPitch[0] = this._cursorPitch + this._doc.song.channels[this._doc.channel].octave * 12;
            };
            this._whenTouchReleased = (event) => {
                event.preventDefault();
                this._doc.synth.pianoPressed = false;
            };
            this._documentChanged = () => {
                const isDrum = this._doc.song.getChannelIsDrum(this._doc.channel);
                this._pitchCount = isDrum ? Config.drumCount : this._doc.getVisiblePitchCount();
                this._pitchHeight = this._editorHeight / this._pitchCount;
                this._updateCursorPitch();
                if (!this._doc.prefs.showLetters)
                    return;
                if (this._renderedScale == this._doc.song.scale && this._renderedKey == this._doc.song.key && this._renderedDrums == isDrum && this._renderedPitchCount == this._pitchCount)
                    return;
                this._renderedScale = this._doc.song.scale;
                this._renderedKey = this._doc.song.key;
                this._renderedDrums = isDrum;
                this._pianoContainer.style.display = isDrum ? "none" : "flex";
                this._drumContainer.style.display = isDrum ? "flex" : "none";
                if (!isDrum) {
                    if (this._renderedPitchCount != this._pitchCount) {
                        this._pianoContainer.innerHTML = "";
                        for (let i = 0; i < this._pitchCount; i++) {
                            const pianoLabel = HTML.div({ class: "piano-label", style: "font-weight: bold; -webkit-text-stroke-width: 0; font-size: 11px; font-family: sans-serif; position: absolute; padding-left: 15px;" });
                            const pianoKey = HTML.div({ class: "piano-button", style: "background: gray;" }, pianoLabel);
                            this._pianoContainer.appendChild(pianoKey);
                            this._pianoLabels[i] = pianoLabel;
                            this._pianoKeys[i] = pianoKey;
                        }
                        this._pianoLabels.length = this._pitchCount;
                        this._pianoKeys.length = this._pitchCount;
                        this._renderedPitchCount = this._pitchCount;
                    }
                    for (let j = 0; j < this._pitchCount; j++) {
                        const pitchNameIndex = (j + Config.keys[this._doc.song.key].basePitch) % Config.pitchesPerOctave;
                        const isWhiteKey = Config.keys[pitchNameIndex].isWhiteKey;
                        this._pianoKeys[j].style.background = isWhiteKey ? ColorConfig.whitePianoKey : ColorConfig.blackPianoKey;
                        if (!Config.scales[this._doc.song.scale].flags[j % Config.pitchesPerOctave]) {
                            this._pianoKeys[j].classList.add("disabled");
                            this._pianoLabels[j].style.display = "none";
                        }
                        else {
                            this._pianoKeys[j].classList.remove("disabled");
                            this._pianoLabels[j].style.display = "";
                            const label = this._pianoLabels[j];
                            label.style.color = Config.keys[pitchNameIndex].isWhiteKey ? "black" : "white";
                            label.textContent = Piano.getPitchName(pitchNameIndex, j);
                        }
                    }
                }
                this._updatePreview();
            };
            for (let i = 0; i < Config.drumCount; i++) {
                const scale = (1.0 - (i / Config.drumCount) * 0.35) * 100;
                this._drumContainer.appendChild(HTML.div({ class: "drum-button", style: `background-size: ${scale}% ${scale}%;` }));
            }
            this._doc.notifier.watch(this._documentChanged);
            this._documentChanged();
            document.addEventListener("mousemove", this._whenMouseMoved);
            document.addEventListener("mouseup", this._whenMouseReleased);
            this.container.addEventListener("mouseover", this._whenMouseOver);
            this.container.addEventListener("mouseout", this._whenMouseOut);
            this.container.addEventListener("touchmove", this._whenTouchMoved);
            this.container.addEventListener("touchend", this._whenTouchReleased);
            this.container.addEventListener("touchcancel", this._whenTouchReleased);
        }
        _updateCursorPitch() {
            const scale = Config.scales[this._doc.song.scale].flags;
            const mousePitch = Math.max(0, Math.min(this._pitchCount - 1, this._pitchCount - (this._mouseY / this._pitchHeight)));
            if (scale[Math.floor(mousePitch) % Config.pitchesPerOctave] || this._doc.song.getChannelIsDrum(this._doc.channel)) {
                this._cursorPitch = Math.floor(mousePitch);
            }
            else {
                let topPitch = Math.floor(mousePitch) + 1;
                let bottomPitch = Math.floor(mousePitch) - 1;
                while (!scale[topPitch % Config.pitchesPerOctave]) {
                    topPitch++;
                }
                while (!scale[(bottomPitch) % Config.pitchesPerOctave]) {
                    bottomPitch--;
                }
                let topRange = topPitch;
                let bottomRange = bottomPitch + 1;
                if (topPitch % Config.pitchesPerOctave == 0 || topPitch % Config.pitchesPerOctave == 7) {
                    topRange -= 0.5;
                }
                if (bottomPitch % Config.pitchesPerOctave == 0 || bottomPitch % Config.pitchesPerOctave == 7) {
                    bottomRange += 0.5;
                }
                this._cursorPitch = mousePitch - bottomRange > topRange - mousePitch ? topPitch : bottomPitch;
            }
        }
        _updatePreview() {
            this._preview.style.visibility = (!this._mouseOver || this._mouseDown) ? "hidden" : "visible";
            if (this._mouseOver && !this._mouseDown) {
                const boundingRect = this.container.getBoundingClientRect();
                const pitchHeight = this._pitchHeight / (this._editorHeight / (boundingRect.bottom - boundingRect.top));
                this._preview.style.left = "0px";
                this._preview.style.top = pitchHeight * (this._pitchCount - this._cursorPitch - 1) + "px";
                this._preview.style.height = pitchHeight + "px";
            }
            const octaveOffset = this._doc.getBaseVisibleOctave(this._doc.channel) * Config.pitchesPerOctave;
            const container = this._doc.song.getChannelIsDrum(this._doc.channel) ? this._drumContainer : this._pianoContainer;
            const children = container.children;
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (this._renderedLiveInputPitches.indexOf(i + octaveOffset) == -1) {
                    child.classList.remove("pressed");
                }
                else {
                    child.classList.add("pressed");
                }
            }
        }
        static getPitchName(pitchNameIndex, scaleIndex) {
            let text;
            if (Config.keys[pitchNameIndex].isWhiteKey) {
                text = Config.keys[pitchNameIndex].name;
            }
            else {
                const shiftDir = Config.blackKeyNameParents[scaleIndex % Config.pitchesPerOctave];
                text = Config.keys[(pitchNameIndex + Config.pitchesPerOctave + shiftDir) % Config.pitchesPerOctave].name;
                if (shiftDir == 1) {
                    text += "♭";
                }
                else if (shiftDir == -1) {
                    text += "♯";
                }
            }
            return text;
        }
    }

    const { button: button$c, div: div$c } = HTML;
    class MixPrompt {
        constructor(_doc) {
            this._doc = _doc;
            this._cancelButton = button$c({}, [div$c("Close")]);
            this.container = div$c({ class: "prompt", style: "width: 300px;" }, [
                div$c({ style: "font-size: 2em" }, [div$c("Mixing Styles")]),
                div$c({ style: "text-align: left; margin: 0.5em 0;" }, [
                    div$c("Mixing styles are a way how changing how loud or soft different sounds are and can change the way different sounds blend and mix together. Using different mixing styles can drastically change your song.")
                ]),
                div$c({ style: "text-align: left; margin: 0.5em 0;" }, [
                    div$c("Type A Mixing is akin to mixing in vanilla Beepbox, Sandbox, and most other beepbox mods. In this mixing type, the drums are about twice as loud as in Type B mixing and the sound is generally a bit sharper and blends together differently.")
                ]),
                div$c({ style: "text-align: left; margin: 0.5em 0;" }, [
                    div$c("Type B Mixing is regular Modbox mixing.")
                ]),
                div$c({ style: "text-align: left; margin: 0.5em 0;" }, [
                    div$c("Type C Mixing is like Type B, save for a few upgrades. There are more volume options in Type C mixing, certain waves (acoustic bass, lyre, ramp pulse, and piccolo) are a bit quieter, the flatline wave is a bit louder, and blending works slightly differently.")
                ]),
                div$c({ style: "text-align: left; margin: 0.5em 0;" }, [
                    div$c("Type D Mixing includes slightly quieter drums from Type B, but also includes sharper sounds for regular notes in pitch channels.")
                ]),
                this._cancelButton,
            ]);
            this._close = () => {
                this._doc.undo();
            };
            this.cleanUp = () => {
                this._cancelButton.removeEventListener("click", this._close);
            };
            this._cancelButton.addEventListener("click", this._close);
        }
    }

    const { button: button$b, div: div$b } = HTML;
    class ChorusPrompt {
        constructor(_doc) {
            this._doc = _doc;
            this._cancelButton = button$b({}, [div$b("Close")]);
            this.container = div$b({ class: "prompt", style: "width: 250px;" }, [
                div$b({ style: "font-size: 2em" }, [div$b("Custom Harmony")]),
                div$b({ style: "text-align: left;" }, [div$b('BeepBox "chip" instruments play two waves at once, each with their own pitch.')]),
                div$b({ style: "text-align: left;" }, [div$b('By placing two notes one above another it will play two indivdual sounds. ' +
                        'This replaces the "arpeggio/trill" effect, and gives you greater control over your harmony. ')]),
                div$b({ style: "text-align: left;" }, [
                    div$b('In older versions of Modbox, union would not allow notes to harmonize properly and needed a special harmonic chorus in order to work. This has been patched in Modbox 3.1.0. ')
                ]),
                this._cancelButton,
            ]);
            this._close = () => {
                this._doc.undo();
            };
            this.cleanUp = () => {
                this._cancelButton.removeEventListener("click", this._close);
            };
            this._cancelButton.addEventListener("click", this._close);
        }
    }

    class SynthChannel {
        constructor() {
            this.sampleLeft = 0.0;
            this.sampleRight = 0.0;
            this.phases = [];
            this.phaseDeltas = [];
            this.volumeStarts = [];
            this.volumeDeltas = [];
            this.volumeLeft = [];
            this.volumeRight = [];
            this.phaseDeltaScale = 0.0;
            this.filter = 0.0;
            this.filterScale = 0.0;
            this.vibratoScale = 0.0;
            this.harmonyMult = 0.0;
            this.harmonyVolumeMult = 1.0;
            this.feedbackOutputs = [];
            this.feedbackMult = 0.0;
            this.feedbackDelta = 0.0;
            this.reset();
        }
        reset() {
            for (let i = 0; i < Config.operatorCount; i++) {
                this.phases[i] = 0.0;
                this.feedbackOutputs[i] = 0.0;
            }
            this.sampleLeft = 0.0;
            this.sampleRight = 0.0;
        }
    }
    class Synth {
        static warmUpSynthesizer(song) {
            if (song != null) {
                for (let i = 0; i < song.instrumentsPerChannel; i++) {
                    for (let j = song.pitchChannelCount; j < song.pitchChannelCount + song.drumChannelCount; j++) {
                        Config.getDrumWave(song.channels[j].instruments[i].wave);
                    }
                }
                for (let i = 0; i < song.barCount; i++) {
                    Synth.getGeneratedSynthesizer(song, i);
                }
            }
        }
        static operatorAmplitudeCurve(amplitude) {
            return (Math.pow(16.0, amplitude / 15.0) - 1.0) / 15.0;
        }
        get playing() {
            return this.isPlaying;
        }
        get playhead() {
            return this.playheadInternal;
        }
        set playhead(value) {
            if (this.song != null) {
                this.playheadInternal = Math.max(0, Math.min(this.song.barCount, value));
                let remainder = this.playheadInternal;
                this.bar = Math.floor(remainder);
                remainder = this.song.beatsPerBar * (remainder - this.bar);
                this.beat = Math.floor(remainder);
                remainder = this.song.partsPerBeat * (remainder - this.beat);
                this.part = Math.floor(remainder);
                remainder = 4 * (remainder - this.part);
                this.arpeggio = Math.floor(remainder);
                const samplesPerTick = this.getSamplesPerArpeggio();
                remainder = samplesPerTick * (remainder - this.arpeggio);
                this.arpSampleCountdown = Math.floor(samplesPerTick - remainder);
                if (this.bar < this.song.loopStart) {
                    this.enableIntro = true;
                }
                if (this.bar > this.song.loopStart + this.song.loopLength) {
                    this.enableOutro = true;
                }
            }
        }
        get totalSamples() {
            if (this.song == null)
                return 0;
            const samplesPerBar = this.getSamplesPerArpeggio() * 4 * this.song.partsPerBeat * this.song.beatsPerBar;
            let loopMinCount = this.loopCount;
            if (loopMinCount < 0)
                loopMinCount = 1;
            let bars = this.song.loopLength * loopMinCount;
            if (this.enableIntro)
                bars += this.song.loopStart;
            if (this.enableOutro)
                bars += this.song.barCount - (this.song.loopStart + this.song.loopLength);
            return bars * samplesPerBar;
        }
        get totalSeconds() {
            return Math.round(this.totalSamples / this.samplesPerSecond);
        }
        get totalBars() {
            if (this.song == null)
                return 0.0;
            return this.song.barCount;
        }
        constructor(song = null) {
            this.samplesPerSecond = 44100;
            this.effectDuration = 0.14;
            this.effectAngle = Math.PI * 2.0 / (this.effectDuration * this.samplesPerSecond);
            this.effectYMult = 2.0 * Math.cos(this.effectAngle);
            this.limitDecay = 1.0 / (2.0 * this.samplesPerSecond);
            this.song = null;
            this.pianoPressed = false;
            this.pianoPitch = [0];
            this.pianoChannel = 0;
            this.enableIntro = true;
            this.enableOutro = false;
            this.loopCount = -1;
            this.volume = 1.0;
            this.liveInputDuration = 0;
            this.liveInputStarted = false;
            this.liveInputPitches = [];
            this.liveInputChannel = 0;
            this.playheadInternal = 0.0;
            this.bar = 0;
            this.beat = 0;
            this.part = 0;
            this.arpeggio = 0;
            this.arpSampleCountdown = 0;
            this.isPlaying = false;
            this.liveInputEndTime = 0.0;
            this.browserAutomaticallyClearsAudioBuffer = true;
            this.channels = [];
            this.stillGoing = false;
            this.effectPhase = 0.0;
            this.limit = 0.0;
            this.delayLineLeft = new Float32Array(16384);
            this.delayLineRight = new Float32Array(16384);
            this.delayPosLeft = 0;
            this.delayPosRight = 0;
            this.delayFeedback0Left = 0.0;
            this.delayFeedback0Right = 0.0;
            this.delayFeedback1Left = 0.0;
            this.delayFeedback1Right = 0.0;
            this.delayFeedback2Left = 0.0;
            this.delayFeedback2Right = 0.0;
            this.delayFeedback3Left = 0.0;
            this.delayFeedback3Right = 0.0;
            this.audioCtx = null;
            this.scriptNode = null;
            this.audioProcessCallback = (audioProcessingEvent) => {
                const outputBuffer = audioProcessingEvent.outputBuffer;
                const outputDataL = outputBuffer.getChannelData(0);
                const outputDataR = outputBuffer.getChannelData(1);
                if (this.browserAutomaticallyClearsAudioBuffer && (outputDataL[0] != 0.0 || outputDataR[0] != 0.0 || outputDataL[outputBuffer.length - 1] != 0.0 || outputDataR[outputBuffer.length - 1] != 0.0)) {
                    this.browserAutomaticallyClearsAudioBuffer = false;
                }
                if (!this.browserAutomaticallyClearsAudioBuffer) {
                    const length = outputBuffer.length;
                    for (let i = 0; i < length; i++) {
                        outputDataL[i] = 0.0;
                        outputDataR[i] = 0.0;
                    }
                }
                if (!this.isPlaying && performance.now() >= this.liveInputEndTime) {
                    this.deactivateAudio();
                }
                else {
                    this.synthesize(outputDataL, outputDataR, outputBuffer.length, this.isPlaying);
                }
            };
            if (song != null)
                this.setSong(song);
        }
        setSong(song) {
            if (typeof (song) == "string") {
                this.song = new Song(song);
            }
            else if (song instanceof Song) {
                this.song = song;
            }
        }
        spsCalc() {
            Synth.warmUpSynthesizer(this.song);
            if (this.song.sampleRate == 0)
                return 44100;
            else if (this.song.sampleRate == 1)
                return 48000;
            else if (this.song.sampleRate == 2)
                return this.audioCtx.sampleRate;
            else if (this.song.sampleRate == 3)
                return this.audioCtx.sampleRate * 4;
            else if (this.song.sampleRate == 4)
                return this.audioCtx.sampleRate * 2;
            else if (this.song.sampleRate == 5)
                return this.audioCtx.sampleRate / 2;
            else if (this.song.sampleRate == 6)
                return this.audioCtx.sampleRate / 4;
            else if (this.song.sampleRate == 7)
                return this.audioCtx.sampleRate / 8;
            else if (this.song.sampleRate == 8)
                return this.audioCtx.sampleRate / 16;
            else
                return this.audioCtx.sampleRate;
        }
        activateAudio() {
            if (this.audioCtx == null || this.scriptNode == null) {
                if (this.scriptNode != null)
                    this.deactivateAudio();
                this.audioCtx = this.audioCtx || new (window.AudioContext || window.webkitAudioContext);
                this.samplesPerSecond = this.spsCalc();
                this.scriptNode = this.audioCtx.createScriptProcessor ? this.audioCtx.createScriptProcessor(2048, 0, 2) : this.audioCtx.createJavaScriptNode(2048, 0, 2);
                this.scriptNode.onaudioprocess = this.audioProcessCallback;
                this.scriptNode.channelCountMode = 'explicit';
                this.scriptNode.channelInterpretation = 'speakers';
                this.effectAngle = Math.PI * 2.0 / (this.effectDuration * this.samplesPerSecond);
                this.effectYMult = 2.0 * Math.cos(this.effectAngle);
                this.limitDecay = 1.0 / (2.0 * this.samplesPerSecond);
                this.scriptNode.connect(this.audioCtx.destination);
            }
            this.audioCtx.resume();
        }
        deactivateAudio() {
            if (this.audioCtx != null && this.scriptNode != null) {
                this.scriptNode.disconnect(this.audioCtx.destination);
                this.scriptNode = null;
                if (this.audioCtx.close)
                    this.audioCtx.close();
                this.audioCtx = null;
            }
        }
        maintainLiveInput() {
            this.activateAudio();
            this.liveInputEndTime = performance.now() + 10000.0;
        }
        play() {
            if (this.isPlaying)
                return;
            this.isPlaying = true;
            Synth.warmUpSynthesizer(this.song);
            this.activateAudio();
        }
        pause() {
            if (!this.isPlaying)
                return;
            this.isPlaying = false;
            this.deactivateAudio();
            this.scriptNode = null;
        }
        snapToStart() {
            this.bar = 0;
            this.enableIntro = true;
            this.snapToBar();
        }
        snapToBar(bar) {
            if (bar !== undefined)
                this.bar = bar;
            this.playheadInternal = this.bar;
            this.beat = 0;
            this.part = 0;
            this.arpeggio = 0;
            this.arpSampleCountdown = 0;
            this.effectPhase = 0.0;
            for (const channel of this.channels)
                channel.reset();
            this.delayPosLeft = 0;
            this.delayPosRight = 0;
            this.delayFeedback0Left = 0.0;
            this.delayFeedback0Right = 0.0;
            this.delayFeedback1Left = 0.0;
            this.delayFeedback1Right = 0.0;
            this.delayFeedback2Left = 0.0;
            this.delayFeedback2Right = 0.0;
            this.delayFeedback3Left = 0.0;
            this.delayFeedback3Right = 0.0;
            for (let i = 0; i < this.delayLineLeft.length; i++)
                this.delayLineLeft[i] = 0.0;
            for (let i = 0; i < this.delayLineRight.length; i++)
                this.delayLineRight[i] = 0.0;
        }
        nextBar() {
            if (!this.song)
                return;
            const oldBar = this.bar;
            this.bar++;
            if (this.enableOutro) {
                if (this.bar >= this.song.barCount) {
                    this.bar = this.enableIntro ? 0 : this.song.loopStart;
                }
            }
            else {
                if (this.bar >= this.song.loopStart + this.song.loopLength || this.bar >= this.song.barCount) {
                    this.bar = this.song.loopStart;
                }
            }
            this.playheadInternal += this.bar - oldBar;
        }
        prevBar() {
            if (!this.song)
                return;
            const oldBar = this.bar;
            this.bar--;
            if (this.bar < 0) {
                this.bar = this.song.loopStart + this.song.loopLength - 1;
            }
            if (this.bar >= this.song.barCount) {
                this.bar = this.song.barCount - 1;
            }
            if (this.bar < this.song.loopStart) {
                this.enableIntro = true;
            }
            if (!this.enableOutro && this.bar >= this.song.loopStart + this.song.loopLength) {
                this.bar = this.song.loopStart + this.song.loopLength - 1;
            }
            this.playheadInternal += this.bar - oldBar;
        }
        synthesize(dataLeft, dataRight, bufferLength, playSong = true) {
            if (this.song == null) {
                for (let i = 0; i < bufferLength; i++) {
                    dataLeft[i] = 0.0;
                    dataRight[i] = 0.0;
                }
                this.deactivateAudio();
                return;
            }
            const channelCount = this.song.getChannelCount();
            for (let i = this.channels.length; i < channelCount; i++) {
                this.channels[i] = new SynthChannel();
            }
            this.channels.length = channelCount;
            const samplesPerTick = this.getSamplesPerArpeggio();
            let bufferIndex = 0;
            let ended = false;
            if (this.arpSampleCountdown == 0 || this.arpSampleCountdown > samplesPerTick) {
                this.arpSampleCountdown = samplesPerTick;
            }
            if (playSong) {
                if (this.part >= this.song.partsPerBeat) {
                    this.beat++;
                    this.part = 0;
                    this.arpeggio = 0;
                    this.arpSampleCountdown = samplesPerTick;
                }
                if (this.beat >= this.song.beatsPerBar) {
                    this.bar++;
                    this.beat = 0;
                    this.part = 0;
                    this.arpeggio = 0;
                    this.arpSampleCountdown = samplesPerTick;
                    if (this.loopCount == -1) {
                        if (this.bar < this.song.loopStart && !this.enableIntro)
                            this.bar = this.song.loopStart;
                        if (this.bar >= this.song.loopStart + this.song.loopLength && !this.enableOutro)
                            this.bar = this.song.loopStart;
                    }
                }
                if (this.bar >= this.song.barCount) {
                    if (this.enableOutro) {
                        this.bar = 0;
                        this.enableIntro = true;
                        ended = true;
                        this.pause();
                    }
                    else {
                        this.bar = this.song.loopStart;
                    }
                }
                if (this.bar >= this.song.loopStart) {
                    this.enableIntro = false;
                }
            }
            while (true) {
                if (ended) {
                    while (bufferIndex < bufferLength) {
                        dataLeft[bufferIndex] = 0.0;
                        dataRight[bufferIndex] = 0.0;
                        bufferIndex++;
                    }
                    break;
                }
                const generatedSynthesizer = Synth.getGeneratedSynthesizer(this.song, this.bar);
                bufferIndex = generatedSynthesizer(this, this.song, dataLeft, dataRight, bufferLength, bufferIndex, samplesPerTick);
                const finishedBuffer = (bufferIndex == -1);
                if (finishedBuffer) {
                    break;
                }
                else {
                    this.beat = 0;
                    this.effectPhase = 0.0;
                    this.bar++;
                    if (this.bar < this.song.loopStart) {
                        if (!this.enableIntro)
                            this.bar = this.song.loopStart;
                    }
                    else {
                        this.enableIntro = false;
                    }
                    if (this.bar >= this.song.loopStart + this.song.loopLength) {
                        if (this.loopCount > 0)
                            this.loopCount--;
                        if (this.loopCount > 0 || !this.enableOutro) {
                            this.bar = this.song.loopStart;
                        }
                    }
                    if (this.bar >= this.song.barCount) {
                        this.bar = 0;
                        this.enableIntro = true;
                        ended = true;
                        this.pause();
                    }
                }
            }
            this.playheadInternal = (((this.arpeggio + 1.0 - this.arpSampleCountdown / samplesPerTick) / 4.0 + this.part) / this.song.partsPerBeat + this.beat) / this.song.beatsPerBar + this.bar;
        }
        static computeOperatorEnvelope(envelope, time, beats, customVolume) {
            switch (Config.operatorEnvelopeType[envelope]) {
                case 0: return customVolume;
                case 1: return 1.0;
                case 4:
                    let curve = 1.0 / (1.0 + time * Config.operatorEnvelopeSpeed[envelope]);
                    if (Config.operatorEnvelopeInverted[envelope]) {
                        return 1.0 - curve;
                    }
                    else {
                        return curve;
                    }
                case 5:
                    if (Config.operatorSpecialCustomVolume[envelope]) {
                        return 0.5 - Math.cos(beats * 2.0 * Math.PI * (customVolume * 4)) * 0.5;
                    }
                    else {
                        return 0.5 - Math.cos(beats * 2.0 * Math.PI * Config.operatorEnvelopeSpeed[envelope]) * 0.5;
                    }
                case 2:
                    return Math.max(1.0, 2.0 - time * 10.0);
                case 3:
                    if (Config.operatorSpecialCustomVolume[envelope]) {
                        const attack = 0.25 / Math.sqrt(customVolume);
                        return time < attack ? time / attack : 1.0 / (1.0 + (time - attack) * (customVolume * 16));
                    }
                    else {
                        const speed = Config.operatorEnvelopeSpeed[envelope];
                        const attack = 0.25 / Math.sqrt(speed);
                        return time < attack ? time / attack : 1.0 / (1.0 + (time - attack) * speed);
                    }
                case 6:
                    return Math.max(-1.0 - time, -2.0 + time);
                default: throw new Error("Unrecognized operator envelope type.");
            }
        }
        static computeChannelInstrument(synth, song, channel, time, sampleTime, samplesPerTick, samples) {
            const isDrum = song.getChannelIsDrum(channel);
            const synthChannel = synth.channels[channel];
            const pattern = song.getPattern(channel, synth.bar);
            const instrument = song.channels[channel].instruments[pattern == null ? 0 : pattern.instrument];
            const pianoMode = (synth.pianoPressed && channel == synth.pianoChannel);
            const basePitch = isDrum ? Config.drumBasePitches[instrument.wave] : Config.keys[song.key].basePitch;
            const intervalScale = isDrum ? Config.drumInterval : 1;
            const pitchDamping = isDrum ? (Config.drumWaveIsSoft[instrument.wave] ? 24.0 : 60.0) : 48.0;
            const secondsPerPart = 4.0 * samplesPerTick / synth.samplesPerSecond;
            const beatsPerPart = 1.0 / song.partsPerBeat;
            synthChannel.phaseDeltaScale = 0.0;
            synthChannel.filter = 1.0;
            synthChannel.filterScale = 1.0;
            synthChannel.vibratoScale = 0.0;
            synthChannel.harmonyMult = 1.0;
            synthChannel.harmonyVolumeMult = 1.0;
            let partsSinceStart = 0.0;
            let arpeggio = synth.arpeggio;
            let arpSampleCountdown = synth.arpSampleCountdown;
            let pitches = null;
            let resetPhases = true;
            let intervalStart = 0.0;
            let intervalEnd = 0.0;
            let transitionVolumeStart = 1.0;
            let transitionVolumeEnd = 1.0;
            let envelopeVolumeStart = 0.0;
            let envelopeVolumeEnd = 0.0;
            let partTimeStart = 0.0;
            let partTimeEnd = 0.0;
            let decayTimeStart = 0.0;
            let decayTimeEnd = 0.0;
            for (let i = 0; i < Config.operatorCount; i++) {
                synthChannel.phaseDeltas[i] = 0.0;
                synthChannel.volumeStarts[i] = 0.0;
                synthChannel.volumeDeltas[i] = 0.0;
                synthChannel.volumeLeft[0] = 0.0;
                synthChannel.volumeRight[0] = 0.0;
            }
            if (pianoMode) {
                pitches = synth.pianoPitch;
                transitionVolumeStart = transitionVolumeEnd = 1;
                envelopeVolumeStart = envelopeVolumeEnd = 1;
                resetPhases = false;
            }
            else if (pattern != null) {
                let note = null;
                let prevNote = null;
                let nextNote = null;
                for (let i = 0; i < pattern.notes.length; i++) {
                    if (pattern.notes[i].end <= time) {
                        prevNote = pattern.notes[i];
                    }
                    else if (pattern.notes[i].start <= time && pattern.notes[i].end > time) {
                        note = pattern.notes[i];
                    }
                    else if (pattern.notes[i].start > time) {
                        nextNote = pattern.notes[i];
                        break;
                    }
                }
                if (note != null && prevNote != null && prevNote.end != note.start)
                    prevNote = null;
                if (note != null && nextNote != null && nextNote.start != note.end)
                    nextNote = null;
                if (note != null) {
                    pitches = note.pitches;
                    partsSinceStart = time - note.start;
                    let endPinIndex;
                    for (endPinIndex = 1; endPinIndex < note.pins.length - 1; endPinIndex++) {
                        if (note.pins[endPinIndex].time + note.start > time)
                            break;
                    }
                    const startPin = note.pins[endPinIndex - 1];
                    const endPin = note.pins[endPinIndex];
                    const noteStart = note.start * 4;
                    const noteEnd = note.end * 4;
                    const pinStart = (note.start + startPin.time) * 4;
                    const pinEnd = (note.start + endPin.time) * 4;
                    const tickTimeStart = time * 4 + arpeggio;
                    const tickTimeEnd = time * 4 + arpeggio + 1;
                    const pinRatioStart = (tickTimeStart - pinStart) / (pinEnd - pinStart);
                    const pinRatioEnd = (tickTimeEnd - pinStart) / (pinEnd - pinStart);
                    let envelopeVolumeTickStart = startPin.volume + (endPin.volume - startPin.volume) * pinRatioStart;
                    let envelopeVolumeTickEnd = startPin.volume + (endPin.volume - startPin.volume) * pinRatioEnd;
                    let transitionVolumeTickStart = 1.0;
                    let transitionVolumeTickEnd = 1.0;
                    let intervalTickStart = startPin.interval + (endPin.interval - startPin.interval) * pinRatioStart;
                    let intervalTickEnd = startPin.interval + (endPin.interval - startPin.interval) * pinRatioEnd;
                    let partTimeTickStart = startPin.time + (endPin.time - startPin.time) * pinRatioStart;
                    let partTimeTickEnd = startPin.time + (endPin.time - startPin.time) * pinRatioEnd;
                    let decayTimeTickStart = partTimeTickStart;
                    let decayTimeTickEnd = partTimeTickEnd;
                    const startRatio = 1.0 - (arpSampleCountdown + samples) / samplesPerTick;
                    const endRatio = 1.0 - (arpSampleCountdown) / samplesPerTick;
                    resetPhases = (tickTimeStart + startRatio - noteStart == 0.0);
                    const transition = instrument.transition;
                    if (tickTimeStart == noteStart) {
                        if (transition == 0) {
                            resetPhases = false;
                        }
                        else if (transition == 2) {
                            transitionVolumeTickStart = 0.0;
                        }
                        else if (transition == 3) {
                            if (prevNote == null) {
                                transitionVolumeTickStart = 0.0;
                            }
                            else if (prevNote.pins[prevNote.pins.length - 1].volume == 0 || note.pins[0].volume == 0) {
                                transitionVolumeTickStart = 0.0;
                            }
                            else {
                                intervalTickStart = (prevNote.pitches[0] + prevNote.pins[prevNote.pins.length - 1].interval - note.pitches[0]) * 0.5;
                                decayTimeTickStart = prevNote.pins[prevNote.pins.length - 1].time * 0.5;
                                resetPhases = false;
                            }
                        }
                        else if (transition == 4) {
                            transitionVolumeTickEnd = 0.0;
                        }
                        else if (transition == 5) {
                            intervalTickStart = 100.0;
                        }
                        else if (transition == 6) {
                            intervalTickStart = -1.0;
                        }
                        else if (transition == 7) {
                            transitionVolumeTickStart = 6.0;
                        }
                    }
                    if (tickTimeEnd == noteEnd) {
                        if (transition == 0) {
                            if (nextNote == null && note.start + endPin.time != song.partsPerBeat * song.beatsPerBar) {
                                transitionVolumeTickEnd = 0.0;
                            }
                        }
                        else if (transition == 1 || transition == 2) {
                            transitionVolumeTickEnd = 0.0;
                        }
                        else if (transition == 3) {
                            if (nextNote == null) {
                                transitionVolumeTickEnd = 0.0;
                            }
                            else if (note.pins[note.pins.length - 1].volume == 0 || nextNote.pins[0].volume == 0) {
                                transitionVolumeTickEnd = 0.0;
                            }
                            else {
                                intervalTickEnd = (nextNote.pitches[0] - note.pitches[0] + note.pins[note.pins.length - 1].interval) * 0.5;
                                decayTimeTickEnd *= 0.5;
                            }
                        }
                    }
                    intervalStart = intervalTickStart + (intervalTickEnd - intervalTickStart) * startRatio;
                    intervalEnd = intervalTickStart + (intervalTickEnd - intervalTickStart) * endRatio;
                    envelopeVolumeStart = synth.volumeConversion(envelopeVolumeTickStart + (envelopeVolumeTickEnd - envelopeVolumeTickStart) * startRatio);
                    envelopeVolumeEnd = synth.volumeConversion(envelopeVolumeTickStart + (envelopeVolumeTickEnd - envelopeVolumeTickStart) * endRatio);
                    transitionVolumeStart = transitionVolumeTickStart + (transitionVolumeTickEnd - transitionVolumeTickStart) * startRatio;
                    transitionVolumeEnd = transitionVolumeTickStart + (transitionVolumeTickEnd - transitionVolumeTickStart) * endRatio;
                    partTimeStart = note.start + partTimeTickStart + (partTimeTickEnd - partTimeTickStart) * startRatio;
                    partTimeEnd = note.start + partTimeTickStart + (partTimeTickEnd - partTimeTickStart) * endRatio;
                    decayTimeStart = decayTimeTickStart + (decayTimeTickEnd - decayTimeTickStart) * startRatio;
                    decayTimeEnd = decayTimeTickStart + (decayTimeTickEnd - decayTimeTickStart) * endRatio;
                }
            }
            if (pitches != null) {
                if (!isDrum && instrument.type == 1) {
                    let sineVolumeBoost = 1.0;
                    let totalCarrierVolume = 0.0;
                    const carrierCount = Config.operatorCarrierCounts[instrument.algorithm];
                    for (let i = 0; i < Config.operatorCount; i++) {
                        const isCarrier = i < Config.operatorCarrierCounts[instrument.algorithm];
                        const associatedCarrierIndex = Config.operatorAssociatedCarrier[instrument.algorithm][i] - 1;
                        const pitch = pitches[(i < pitches.length) ? i : ((associatedCarrierIndex < pitches.length) ? associatedCarrierIndex : 0)] + Config.octoffValues[instrument.octoff] + (song.detune / 24);
                        const freqMult = Config.operatorFrequencies[instrument.operators[i].frequency];
                        const chorusInterval = Config.operatorCarrierChorus[Config.fmChorusNames[instrument.fmChorus]][associatedCarrierIndex];
                        const startPitch = (pitch + intervalStart) * intervalScale + chorusInterval;
                        const startFreq = freqMult * (synth.frequencyFromPitch(basePitch + startPitch)) + Config.operatorHzOffsets[instrument.operators[i].frequency];
                        synthChannel.phaseDeltas[i] = startFreq * sampleTime * Config.sineWaveLength;
                        if (resetPhases)
                            synthChannel.reset();
                        const amplitudeCurve = Synth.operatorAmplitudeCurve(instrument.operators[i].amplitude);
                        let amplitudeMult = 0;
                        if ((Config.volumeValues[instrument.volume] != -1.0 && song.mix == 2) || (Config.volumeMValues[instrument.volume] != -1.0 && song.mix != 2)) {
                            if (song.mix == 2) {
                                amplitudeMult = isCarrier ? (amplitudeCurve * Config.operatorAmplitudeSigns[instrument.operators[i].frequency]) * (1 - Config.volumeValues[instrument.volume] / 2.3) : (amplitudeCurve * Config.operatorAmplitudeSigns[instrument.operators[i].frequency]);
                            }
                            else {
                                amplitudeMult = (amplitudeCurve * Config.operatorAmplitudeSigns[instrument.operators[i].frequency]) * (1 - Config.volumeMValues[instrument.volume] / 2.3);
                            }
                        }
                        else if (Config.volumeValues[instrument.volume] != -1.0) {
                            amplitudeMult = 0;
                        }
                        else if (Config.volumeMValues[instrument.volume] != -1.0) {
                            amplitudeMult = 0;
                        }
                        let volumeStart = amplitudeMult * Config.imuteValues[instrument.imute];
                        let volumeEnd = amplitudeMult * Config.imuteValues[instrument.imute];
                        synthChannel.volumeLeft[0] = Math.min(1, 1 + Config.ipanValues[instrument.ipan]);
                        synthChannel.volumeRight[0] = Math.min(1, 1 - Config.ipanValues[instrument.ipan]);
                        if (i < carrierCount) {
                            const volumeMult = 0.03;
                            const endPitch = (pitch + intervalEnd) * intervalScale;
                            let pitchVolumeStart = 0;
                            let pitchVolumeEnd = 0;
                            if (song.mix == 3) {
                                pitchVolumeStart = Math.pow(5.0, -startPitch / pitchDamping);
                                pitchVolumeEnd = Math.pow(5.0, -endPitch / pitchDamping);
                            }
                            else {
                                pitchVolumeStart = Math.pow(2.0, -startPitch / pitchDamping);
                                pitchVolumeEnd = Math.pow(2.0, -endPitch / pitchDamping);
                            }
                            volumeStart *= pitchVolumeStart * volumeMult * transitionVolumeStart;
                            volumeEnd *= pitchVolumeEnd * volumeMult * transitionVolumeEnd;
                            totalCarrierVolume += amplitudeCurve;
                        }
                        else {
                            volumeStart *= Config.sineWaveLength * 1.5;
                            volumeEnd *= Config.sineWaveLength * 1.5;
                            sineVolumeBoost *= 1.0 - Math.min(1.0, instrument.operators[i].amplitude / 15);
                        }
                        const envelope = instrument.operators[i].envelope;
                        volumeStart *= Synth.computeOperatorEnvelope(envelope, secondsPerPart * decayTimeStart, beatsPerPart * partTimeStart, envelopeVolumeStart);
                        volumeEnd *= Synth.computeOperatorEnvelope(envelope, secondsPerPart * decayTimeEnd, beatsPerPart * partTimeEnd, envelopeVolumeEnd);
                        synthChannel.volumeStarts[i] = volumeStart;
                        synthChannel.volumeDeltas[i] = (volumeEnd - volumeStart) / samples;
                    }
                    const feedbackAmplitude = Config.sineWaveLength * 0.3 * instrument.feedbackAmplitude / 15.0;
                    let feedbackStart = feedbackAmplitude * Synth.computeOperatorEnvelope(instrument.feedbackEnvelope, secondsPerPart * decayTimeStart, beatsPerPart * partTimeStart, envelopeVolumeStart);
                    let feedbackEnd = feedbackAmplitude * Synth.computeOperatorEnvelope(instrument.feedbackEnvelope, secondsPerPart * decayTimeEnd, beatsPerPart * partTimeEnd, envelopeVolumeEnd);
                    synthChannel.feedbackMult = feedbackStart;
                    synthChannel.feedbackDelta = (feedbackEnd - synthChannel.feedbackMult) / samples;
                    sineVolumeBoost *= 1.0 - instrument.feedbackAmplitude / 15.0;
                    sineVolumeBoost *= 1.0 - Math.min(1.0, Math.max(0.0, totalCarrierVolume - 1) / 2.0);
                    for (let i = 0; i < carrierCount; i++) {
                        synthChannel.volumeStarts[i] *= 1.0 + sineVolumeBoost * 3.0;
                        synthChannel.volumeDeltas[i] *= 1.0 + sineVolumeBoost * 3.0;
                    }
                }
                else {
                    let pitch = pitches[0];
                    if (!isDrum) {
                        if (Config.harmNames[instrument.harm] == 1) {
                            let harmonyOffset = 0.0;
                            if (pitches.length == 2) {
                                harmonyOffset = pitches[1] - pitches[0];
                            }
                            else if (pitches.length == 3) {
                                harmonyOffset = pitches[(arpeggio >> 1) + 1] - pitches[0];
                            }
                            else if (pitches.length == 4) {
                                harmonyOffset = pitches[(arpeggio == 3 ? 1 : arpeggio) + 1] - pitches[0];
                            }
                            synthChannel.harmonyMult = Math.pow(2.0, harmonyOffset / 12.0);
                            synthChannel.harmonyVolumeMult = Math.pow(2.0, -harmonyOffset / pitchDamping);
                        }
                        else if (Config.harmNames[instrument.harm] == 2) {
                            let harmonyOffset = 0.0;
                            if (pitches.length == 2) {
                                harmonyOffset = pitches[1] - pitches[0];
                            }
                            else if (pitches.length == 3) {
                                harmonyOffset = pitches[2] - pitches[0];
                            }
                            else if (pitches.length == 4) {
                                harmonyOffset = pitches[(arpeggio == 3 ? 2 : arpeggio) + 1] - pitches[0];
                            }
                            synthChannel.harmonyMult = Math.pow(2.0, harmonyOffset / 12.0);
                            synthChannel.harmonyVolumeMult = Math.pow(2.0, -harmonyOffset / pitchDamping);
                        }
                        else if (Config.harmNames[instrument.harm] == 3) {
                            let harmonyOffset = 0.0;
                            if (pitches.length == 2) {
                                harmonyOffset = pitches[1] - pitches[0];
                            }
                            else if (pitches.length == 3) {
                                harmonyOffset = pitches[2] - pitches[0];
                            }
                            else if (pitches.length == 4) {
                                harmonyOffset = pitches[3] - pitches[0];
                            }
                            synthChannel.harmonyMult = Math.pow(2.0, harmonyOffset / 12.0);
                            synthChannel.harmonyVolumeMult = Math.pow(2.0, -harmonyOffset / pitchDamping);
                        }
                        else if (Config.harmNames[instrument.harm] == 4) {
                            let harmonyOffset = 0.0;
                            if (pitches.length == 2) {
                                harmonyOffset = pitches[1] - pitches[0];
                            }
                            else if (pitches.length == 3) {
                                harmonyOffset = pitches[(arpeggio >> 1) + 1] - pitches[0];
                            }
                            else if (pitches.length == 4) {
                                harmonyOffset = pitches[(arpeggio >> 1) + 2] - pitches[0];
                            }
                            synthChannel.harmonyMult = Math.pow(2.0, harmonyOffset / 12.0);
                            synthChannel.harmonyVolumeMult = Math.pow(2.0, -harmonyOffset / pitchDamping);
                        }
                        else if (Config.harmNames[instrument.harm] == 5) {
                            let harmonyOffset = 0.0;
                            if (pitches.length == 2) {
                                harmonyOffset = pitches[1] - pitches[0];
                            }
                            else if (pitches.length == 3) {
                                harmonyOffset = pitches[2] - pitches[0];
                            }
                            else if (pitches.length == 4) {
                                harmonyOffset = pitches[(arpeggio == 3 ? 2 : arpeggio)] - pitches[0];
                            }
                            synthChannel.harmonyMult = Math.pow(2.0, harmonyOffset / 12.0);
                            synthChannel.harmonyVolumeMult = Math.pow(2.0, -harmonyOffset / pitchDamping);
                        }
                        else if (Config.harmNames[instrument.harm] == 0) {
                            if (pitches.length == 2) {
                                pitch = pitches[arpeggio >> 1];
                            }
                            else if (pitches.length == 3) {
                                pitch = pitches[arpeggio == 3 ? 1 : arpeggio];
                            }
                            else if (pitches.length == 4) {
                                pitch = pitches[arpeggio];
                            }
                        }
                    }
                    else {
                        if (Config.harmNames[instrument.harm] == 0) {
                            if (pitches.length == 1) {
                                pitch = pitches[0] + Config.octoffValues[instrument.octoff];
                            }
                            else if (pitches.length == 2) {
                                pitch = pitches[arpeggio >> 1] + Config.octoffValues[instrument.octoff];
                            }
                            else if (pitches.length == 3) {
                                pitch = pitches[arpeggio == 3 ? 1 : arpeggio] + Config.octoffValues[instrument.octoff];
                            }
                            else if (pitches.length == 4) {
                                pitch = pitches[arpeggio] + Config.octoffValues[instrument.octoff];
                            }
                        }
                        else if (Config.harmNames[instrument.harm] == 1) {
                            if (pitches.length == 1) {
                                pitch = pitches[0] + Config.octoffValues[instrument.octoff];
                            }
                            else if (pitches.length == 2) {
                                pitch = (pitches[1] + pitches[0]) / 2 + Config.octoffValues[instrument.octoff];
                            }
                            else if (pitches.length == 3) {
                                pitch = (pitches[(arpeggio >> 1) + 1] + pitches[0]) / 2 + Config.octoffValues[instrument.octoff];
                            }
                            else if (pitches.length == 4) {
                                pitch = (pitches[(arpeggio == 3 ? 1 : arpeggio) + 1] + pitches[0]) / 2 + Config.octoffValues[instrument.octoff];
                            }
                        }
                        else if (Config.harmNames[instrument.harm] == 2) {
                            if (pitches.length == 1) {
                                pitch = pitches[0] + Config.octoffValues[instrument.octoff];
                            }
                            else if (pitches.length == 2) {
                                pitch = (pitches[1] + pitches[0]) / 2 + Config.octoffValues[instrument.octoff];
                            }
                            else if (pitches.length == 3) {
                                pitch = (pitches[2] + pitches[0]) / 2 + Config.octoffValues[instrument.octoff];
                            }
                            else if (pitches.length == 4) {
                                pitch = (pitches[(arpeggio == 3 ? 2 : arpeggio) + 1] + pitches[0]) / 2 + Config.octoffValues[instrument.octoff];
                            }
                        }
                        else if (Config.harmNames[instrument.harm] == 3) {
                            if (pitches.length == 1) {
                                pitch = pitches[0] + Config.octoffValues[instrument.octoff];
                            }
                            else if (pitches.length == 2) {
                                pitch = (pitches[1] + pitches[0]) / 2 + Config.octoffValues[instrument.octoff];
                            }
                            else if (pitches.length == 3) {
                                pitch = (pitches[2] + pitches[0]) / 2 + Config.octoffValues[instrument.octoff];
                            }
                            else if (pitches.length == 4) {
                                pitch = (pitches[3] + pitches[0]) / 2 + Config.octoffValues[instrument.octoff];
                            }
                        }
                        else if (Config.harmNames[instrument.harm] == 4) {
                            if (pitches.length == 1) {
                                pitch = pitches[0] + Config.octoffValues[instrument.octoff];
                            }
                            else if (pitches.length == 2) {
                                pitch = (pitches[1] + pitches[0]) / 2 + Config.octoffValues[instrument.octoff];
                            }
                            else if (pitches.length == 3) {
                                pitch = (pitches[(arpeggio >> 1) + 1] + pitches[0]) / 2 + Config.octoffValues[instrument.octoff];
                            }
                            else if (pitches.length == 4) {
                                pitch = pitches[(arpeggio >> 1) + 2] + pitches[0] + Config.octoffValues[instrument.octoff];
                            }
                        }
                    }
                    const startPitch = (pitch + intervalStart) * intervalScale;
                    const endPitch = (pitch + intervalEnd) * intervalScale;
                    const startFreq = synth.frequencyFromPitch(basePitch + startPitch);
                    const pitchVolumeStart = Math.pow(2.0, -startPitch / pitchDamping);
                    const pitchVolumeEnd = Math.pow(2.0, -endPitch / pitchDamping);
                    if (isDrum && Config.drumWaveIsSoft[instrument.wave]) {
                        synthChannel.filter = Math.min(1.0, startFreq * sampleTime * Config.drumPitchFilterMult[instrument.wave]);
                    }
                    let settingsVolumeMult;
                    if (!isDrum) {
                        const filterScaleRate = Config.filterDecays[instrument.filter];
                        synthChannel.filter = Math.pow(2, -filterScaleRate * secondsPerPart * decayTimeStart);
                        const endFilter = Math.pow(2, -filterScaleRate * secondsPerPart * decayTimeEnd);
                        synthChannel.filterScale = Math.pow(endFilter / synthChannel.filter, 1.0 / samples);
                        settingsVolumeMult = 0.27 * 0.5 * Config.waveVolumes[instrument.wave] * Config.filterVolumes[instrument.filter] * Config.chorusVolumes[instrument.chorus];
                    }
                    else {
                        if (song.mix == 0) {
                            settingsVolumeMult = 0.19 * Config.drumVolumes[instrument.wave];
                        }
                        else if (song.mix == 3) {
                            settingsVolumeMult = 0.12 * Config.drumVolumes[instrument.wave];
                        }
                        else {
                            settingsVolumeMult = 0.09 * Config.drumVolumes[instrument.wave];
                        }
                    }
                    if (resetPhases && !isDrum) {
                        synthChannel.reset();
                    }
                    synthChannel.phaseDeltas[0] = startFreq * sampleTime;
                    let instrumentVolumeMult = 0;
                    if (song.mix == 2) {
                        instrumentVolumeMult = (instrument.volume == 9) ? 0.0 : Math.pow(3, -Config.volumeValues[instrument.volume]) * Config.imuteValues[instrument.imute];
                    }
                    else if (song.mix == 1) {
                        instrumentVolumeMult = (instrument.volume >= 5) ? 0.0 : Math.pow(3, -Config.volumeMValues[instrument.volume]) * Config.imuteValues[instrument.imute];
                    }
                    else {
                        instrumentVolumeMult = (instrument.volume >= 5) ? 0.0 : Math.pow(2, -Config.volumeMValues[instrument.volume]) * Config.imuteValues[instrument.imute];
                    }
                    synthChannel.volumeStarts[0] = transitionVolumeStart * envelopeVolumeStart * pitchVolumeStart * settingsVolumeMult * instrumentVolumeMult;
                    const volumeEnd = transitionVolumeEnd * envelopeVolumeEnd * pitchVolumeEnd * settingsVolumeMult * instrumentVolumeMult;
                    synthChannel.volumeDeltas[0] = (volumeEnd - synthChannel.volumeStarts[0]) / samples;
                    synthChannel.volumeLeft[0] = Math.min(1, 1 + Config.ipanValues[instrument.ipan]);
                    synthChannel.volumeRight[0] = Math.min(1, 1 - Config.ipanValues[instrument.ipan]);
                }
                synthChannel.phaseDeltaScale = Math.pow(2.0, ((intervalEnd - intervalStart) * intervalScale / 12.0) / samples);
                synthChannel.vibratoScale = (partsSinceStart < Config.effectVibratoDelays[instrument.effect]) ? 0.0 : Math.pow(2.0, Config.effectVibratos[instrument.effect] / 12.0) - 1.0;
            }
            else {
                synthChannel.reset();
                for (let i = 0; i < Config.operatorCount; i++) {
                    synthChannel.phaseDeltas[0] = 0.0;
                    synthChannel.volumeStarts[0] = 0.0;
                    synthChannel.volumeDeltas[0] = 0.0;
                    synthChannel.volumeLeft[0] = 0.0;
                    synthChannel.volumeRight[0] = 0.0;
                }
            }
        }
        static getGeneratedSynthesizer(song, bar) {
            const fingerprint = song.getChannelFingerprint(bar);
            if (Synth.generatedSynthesizers[fingerprint] == undefined) {
                const synthSource = [];
                const instruments = [];
                for (let channel = 0; channel < song.pitchChannelCount; channel++) {
                    instruments[channel] = song.channels[channel].instruments[song.getPatternInstrument(channel, bar)];
                }
                for (const line of Synth.synthSourceTemplate) {
                    if (line.indexOf("#") != -1) {
                        if (line.indexOf("// PITCH") != -1) {
                            for (let channel = 0; channel < song.pitchChannelCount; channel++) {
                                synthSource.push(line.replace(/#/g, channel + ""));
                            }
                        }
                        else if (line.indexOf("// JCHIP") != -1) {
                            for (let channel = 0; channel < song.pitchChannelCount; channel++) {
                                if (instruments[channel].type == 0) {
                                    synthSource.push(line.replace(/#/g, channel + ""));
                                }
                            }
                        }
                        else if (line.indexOf("// CHIP") != -1) {
                            for (let channel = 0; channel < song.pitchChannelCount; channel++) {
                                if (instruments[channel].type == 0) {
                                    synthSource.push(line.replace(/#/g, channel + ""));
                                }
                                else if (instruments[channel].type == 3) {
                                    synthSource.push(line.replace(/#/g, channel + ""));
                                }
                            }
                        }
                        else if (line.indexOf("// FM") != -1) {
                            for (let channel = 0; channel < song.pitchChannelCount; channel++) {
                                if (instruments[channel].type == 1) {
                                    if (line.indexOf("$") != -1) {
                                        for (let j = 0; j < Config.operatorCount; j++) {
                                            synthSource.push(line.replace(/#/g, channel + "").replace(/\$/g, j + ""));
                                        }
                                    }
                                    else {
                                        synthSource.push(line.replace(/#/g, channel + ""));
                                    }
                                }
                            }
                        }
                        else if (line.indexOf("// PWM") != -1) {
                            for (let channel = 0; channel < song.pitchChannelCount; channel++) {
                                if (instruments[channel].type == 3) {
                                    synthSource.push(line.replace(/#/g, channel + ""));
                                }
                            }
                        }
                        else if (line.indexOf("// CARRIER OUTPUTS") != -1) {
                            for (let channel = 0; channel < song.pitchChannelCount; channel++) {
                                if (instruments[channel].type == 1) {
                                    const outputs = [];
                                    for (let j = 0; j < Config.operatorCarrierCounts[instruments[channel].algorithm]; j++) {
                                        outputs.push("channel" + channel + "Operator" + j + "Scaled");
                                    }
                                    synthSource.push(line.replace(/#/g, channel + "").replace("/*channel" + channel + "Operator$Scaled*/", outputs.join(" + ")));
                                }
                            }
                        }
                        else if (line.indexOf("// NOISE") != -1) {
                            for (let channel = song.pitchChannelCount; channel < song.pitchChannelCount + song.drumChannelCount; channel++) {
                                synthSource.push(line.replace(/#/g, channel + ""));
                            }
                        }
                        else if (line.indexOf("// ALL") != -1) {
                            for (let channel = 0; channel < song.pitchChannelCount + song.drumChannelCount; channel++) {
                                synthSource.push(line.replace(/#/g, channel + ""));
                            }
                        }
                        else {
                            throw new Error("Missing channel type annotation for line: " + line);
                        }
                    }
                    else if (line.indexOf("// INSERT OPERATOR COMPUTATION HERE") != -1) {
                        for (let j = Config.operatorCount - 1; j >= 0; j--) {
                            for (const operatorLine of Synth.operatorSourceTemplate) {
                                for (let channel = 0; channel < song.pitchChannelCount; channel++) {
                                    if (instruments[channel].type == 1) {
                                        if (operatorLine.indexOf("/* + channel#Operator@Scaled*/") != -1) {
                                            let modulators = "";
                                            for (const modulatorNumber of Config.operatorModulatedBy[instruments[channel].algorithm][j]) {
                                                modulators += " + channel" + channel + "Operator" + (modulatorNumber - 1) + "Scaled";
                                            }
                                            const feedbackIndices = Config.operatorFeedbackIndices[instruments[channel].feedbackType][j];
                                            if (feedbackIndices.length > 0) {
                                                modulators += " + channel" + channel + "FeedbackMult * (";
                                                const feedbacks = [];
                                                for (const modulatorNumber of feedbackIndices) {
                                                    feedbacks.push("channel" + channel + "Operator" + (modulatorNumber - 1) + "Output");
                                                }
                                                modulators += feedbacks.join(" + ") + ")";
                                            }
                                            synthSource.push(operatorLine.replace(/#/g, channel + "").replace(/\$/g, j + "").replace("/* + channel" + channel + "Operator@Scaled*/", modulators));
                                        }
                                        else {
                                            synthSource.push(operatorLine.replace(/#/g, channel + "").replace(/\$/g, j + ""));
                                        }
                                    }
                                }
                            }
                        }
                    }
                    else {
                        synthSource.push(line);
                    }
                }
                Synth.generatedSynthesizers[fingerprint] = new Function("synth", "song", "dataLeft", "dataRight", "bufferLength", "bufferIndex", "samplesPerTick", synthSource.join("\n"));
            }
            return Synth.generatedSynthesizers[fingerprint];
        }
        frequencyFromPitch(pitch) {
            return 440.0 * Math.pow(2.0, (pitch - 69.0) / 12.0);
        }
        volumeConversion(noteVolume) {
            return Math.pow(noteVolume / 3.0, 1.5);
        }
        getSamplesPerArpeggio() {
            if (this.song == null)
                return 0;
            const beatsPerMinute = this.song.getBeatsPerMinute();
            const beatsPerSecond = beatsPerMinute / 60.0;
            const partsPerSecond = beatsPerSecond * this.song.partsPerBeat;
            const arpeggioPerSecond = partsPerSecond * 4.0;
            return Math.floor(this.samplesPerSecond / arpeggioPerSecond);
        }
    }
    Synth.negativePhaseGuard = 1000;
    Synth.generatedSynthesizers = {};
    Synth.synthSourceTemplate = (`
			var sampleTime = 1.0 / synth.samplesPerSecond;
			var effectYMult = +synth.effectYMult;
			var limitDecay = +synth.limitDecay;
			var volume = +synth.volume;
			var delayLineLeft = synth.delayLineLeft;
			var delayLineRight = synth.delayLineRight;
			var reverb = Math.pow(song.reverb / beepbox.Config.reverbRange, 0.667) * 0.425;
			var blend = Math.pow(song.blend / beepbox.Config.blendRange, 0.667) * 0.425;
			var mix = song.mix;
			var muff = Math.pow(song.muff / beepbox.Config.muffRange, 0.667) * 0.425;
			var detune = song.detune;
			var riff = Math.pow(song.riff / beepbox.Config.riffRange, 0.667) * 0.425; 
			var sineWave = beepbox.Config.sineWave;
			
			// Initialize instruments based on current pattern.
			var instrumentChannel# = song.getPatternInstrument(#, synth.bar); // ALL
			var instrument# = song.channels[#].instruments[instrumentChannel#]; // ALL
			var channel#Wave = (mix <= 1) ? beepbox.Config.waves[instrument#.wave] : beepbox.Config.wavesMixC[instrument#.wave]; // CHIP
			var channel#Wave = beepbox.Config.getDrumWave(instrument#.wave); // NOISE
			var channel#WaveLength = channel#Wave.length; // CHIP
			var channel#Wave = beepbox.Config.pwmwaves[instrument#.wave]; // PWM
			var channel#WaveLength = channel#Wave.length; // PWM
			var channel#FilterBase = (song.mix == 2) ? Math.pow(2 - (blend * 2) + (muff * 2), -beepbox.Config.filterBases[instrument#.filter]) : Math.pow(2, -beepbox.Config.filterBases[instrument#.filter] + (blend * 4) - (muff * 4)); // CHIP
			var channel#TremoloScale = beepbox.Config.effectTremolos[instrument#.effect]; // PITCH
			
			while (bufferIndex < bufferLength) {
				
				var samples;
				var samplesLeftInBuffer = bufferLength - bufferIndex;
				if (synth.arpSampleCountdown <= samplesLeftInBuffer) {
					samples = synth.arpSampleCountdown;
				} else {
					samples = samplesLeftInBuffer;
				}
				synth.arpSampleCountdown -= samples;
				
				var time = synth.part + synth.beat * song.partsPerBeat;
				
				beepbox.Synth.computeChannelInstrument(synth, song, #, time, sampleTime, samplesPerTick, samples); // ALL
				var synthChannel# = synth.channels[#]; // ALL
				
				var channel#ChorusA = Math.pow(2.0, (beepbox.Config.chorusOffsets[instrument#.chorus] + beepbox.Config.chorusIntervals[instrument#.chorus] + beepbox.Config.octoffValues[instrument#.octoff] + (detune / 24) * ((riff * beepbox.Config.chorusRiffApp[instrument#.chorus]) + 1)) / 12.0); // CHIP
				var channel#ChorusB = Math.pow(2.0, (beepbox.Config.chorusOffsets[instrument#.chorus] - beepbox.Config.chorusIntervals[instrument#.chorus] + beepbox.Config.octoffValues[instrument#.octoff] + (detune / 24) * ((riff * beepbox.Config.chorusRiffApp[instrument#.chorus]) + 1)) / 12.0); // CHIP
				var channel#ChorusSign = synthChannel#.harmonyVolumeMult * (beepbox.Config.chorusSigns[instrument#.chorus]); // CHIP
				channel#ChorusB *= synthChannel#.harmonyMult; // CHIP
				var channel#ChorusDeltaRatio = channel#ChorusB / channel#ChorusA * ((riff * beepbox.Config.chorusRiffApp[instrument#.chorus]) + 1); // CHIP
				
				var channel#PhaseDelta = synthChannel#.phaseDeltas[0] * channel#ChorusA * ((riff * beepbox.Config.chorusRiffApp[instrument#.chorus]) + 1); // CHIP
				var channel#PhaseDelta = synthChannel#.phaseDeltas[0] / 32768.0; // NOISE
				var channel#PhaseDeltaScale = synthChannel#.phaseDeltaScale; // ALL
				var channel#Volume = synthChannel#.volumeStarts[0]; // CHIP
				var channel#Volume = synthChannel#.volumeStarts[0]; // NOISE
				var channel#VolumeLeft = synthChannel#.volumeLeft[0]; // ALL
				var channel#VolumeRight = synthChannel#.volumeRight[0]; // ALL
				var channel#VolumeDelta = synthChannel#.volumeDeltas[0]; // CHIP
				var channel#VolumeDelta = synthChannel#.volumeDeltas[0]; // NOISE
				var channel#Filter = synthChannel#.filter * channel#FilterBase; // CHIP
				var channel#Filter = synthChannel#.filter; // NOISE
				var channel#FilterScale = synthChannel#.filterScale; // CHIP
				var channel#VibratoScale = synthChannel#.vibratoScale; // PITCH
				
				var effectY     = Math.sin(synth.effectPhase);
				var prevEffectY = Math.sin(synth.effectPhase - synth.effectAngle);
				
				var channel#PhaseA = synth.channels[#].phases[0] % 1; // CHIP
				var channel#PhaseB = synth.channels[#].phases[1] % 1; // CHIP
				var channel#Phase  = synth.channels[#].phases[0] % 1; // NOISE
				
				var channel#Operator$Phase       = ((synth.channels[#].phases[$] % 1) + ` + Synth.negativePhaseGuard + `) * ` + Config.sineWaveLength + `; // FM
				var channel#Operator$PhaseDelta  = synthChannel#.phaseDeltas[$]; // FM
				var channel#Operator$OutputMult  = synthChannel#.volumeStarts[$]; // FM
				var channel#Operator$OutputDelta = synthChannel#.volumeDeltas[$]; // FM
				var channel#Operator$Output      = synthChannel#.feedbackOutputs[$]; // FM
				var channel#FeedbackMult         = synthChannel#.feedbackMult; // FM
				var channel#FeedbackDelta        = synthChannel#.feedbackDelta; // FM
				
				var channel#SampleLeft = +synth.channels[#].sampleLeft; // ALL
				var channel#SampleRight = +synth.channels[#].sampleRight; // ALL
				
				var delayPosLeft = 0|synth.delayPosLeft;
				var delayFeedback0Left = +synth.delayFeedback0Left;
				var delayFeedback1Left = +synth.delayFeedback1Left;
				var delayFeedback2Left = +synth.delayFeedback2Left;
				var delayFeedback3Left = +synth.delayFeedback3Left;
				var delayPosRight = 0|synth.delayPosRight;
				var delayFeedback0Right = +synth.delayFeedback0Right;
				var delayFeedback1Right = +synth.delayFeedback1Right;
				var delayFeedback2Right = +synth.delayFeedback2Right;
				var delayFeedback3Right = +synth.delayFeedback3Right;
				var limit = +synth.limit;
				
				while (samples) {
					var channel#Vibrato = 1.0 + channel#VibratoScale * effectY; // PITCH
					var channel#Tremolo = 1.0 + channel#TremoloScale * (effectY - 1.0); // PITCH
					var temp = effectY;
					effectY = effectYMult * effectY - prevEffectY;
					prevEffectY = temp;
					
					channel#SampleLeft += ((channel#Wave[0|(channel#PhaseA * channel#WaveLength)] + channel#Wave[0|(channel#PhaseB * channel#WaveLength)] * channel#ChorusSign) * channel#Volume * channel#Tremolo - channel#SampleLeft) * channel#Filter * channel#VolumeLeft; // CHIP 
					channel#SampleLeft += (channel#Wave[0|(channel#Phase * 32768.0)] * channel#Volume - channel#SampleLeft) * channel#Filter * channel#VolumeLeft; // NOISE
					channel#SampleRight += ((channel#Wave[0|(channel#PhaseA * channel#WaveLength)] + channel#Wave[0|(channel#PhaseB * channel#WaveLength)] * channel#ChorusSign) * channel#Volume * channel#Tremolo - channel#SampleRight) * channel#Filter * channel#VolumeRight; // CHIP 
					channel#SampleRight += (channel#Wave[0|(channel#Phase * 32768.0)] * channel#Volume - channel#SampleRight) * channel#Filter * channel#VolumeRight; // NOISE
					channel#Volume += channel#VolumeDelta; // CHIP
					channel#Volume += channel#VolumeDelta; // NOISE
					channel#PhaseA += channel#PhaseDelta * channel#Vibrato; // CHIP
					channel#PhaseB += channel#PhaseDelta * channel#Vibrato * channel#ChorusDeltaRatio; // CHIP
					channel#Phase += channel#PhaseDelta; // NOISE
					channel#Filter *= channel#FilterScale; // CHIP
					channel#PhaseA -= 0|channel#PhaseA; // CHIP
					channel#PhaseB -= 0|channel#PhaseB; // CHIP
					channel#Phase -= 0|channel#Phase; // NOISE
					channel#PhaseDelta *= channel#PhaseDeltaScale; // CHIP
					channel#PhaseDelta *= channel#PhaseDeltaScale; // NOISE
					
					// INSERT OPERATOR COMPUTATION HERE
					channel#SampleLeft = channel#Tremolo * (/*channel#Operator$Scaled*/) * channel#VolumeLeft; // CARRIER OUTPUTS
					channel#SampleRight = channel#Tremolo * (/*channel#Operator$Scaled*/) * channel#VolumeRight; // CARRIER OUTPUTS
					channel#FeedbackMult += channel#FeedbackDelta; // FM
					channel#Operator$OutputMult += channel#Operator$OutputDelta; // FM
					channel#Operator$Phase += channel#Operator$PhaseDelta * channel#Vibrato; // FM
					channel#Operator$PhaseDelta *= channel#PhaseDeltaScale; // FM
					
					// Reverb, implemented using a feedback delay network with a Hadamard matrix and lowpass filters.
					// good ratios:    0.555235 + 0.618033 + 0.818 +   1.0 = 2.991268
					// Delay lengths:  3041     + 3385     + 4481  +  5477 = 16384 = 2^14
					// Buffer offsets: 3041    -> 6426   -> 10907 -> 16384
					var delayPos1Left = (delayPosLeft +  3041) & 0x3FFF;
					var delayPos2Left = (delayPosLeft +  6426) & 0x3FFF;
					var delayPos3Left = (delayPosLeft + 10907) & 0x3FFF;
					var delaySampleLeft0 = (delayLineLeft[delayPosLeft]
						+ channel#SampleLeft // PITCH
					);
					var delayPos1Right = (delayPosRight +  3041) & 0x3FFF;
					var delayPos2Right = (delayPosRight +  6426) & 0x3FFF;
					var delayPos3Right = (delayPosRight + 10907) & 0x3FFF;
					var delaySampleRight0 = (delayLineRight[delayPosRight]
						+ channel#SampleRight // PITCH
					);
					var delaySampleLeft1 = delayLineLeft[delayPos1Left];
					var delaySampleLeft2 = delayLineLeft[delayPos2Left];
					var delaySampleLeft3 = delayLineLeft[delayPos3Left];
					var delayTemp0Left = -delaySampleLeft0 + delaySampleLeft1;
					var delayTemp1Left = -delaySampleLeft0 - delaySampleLeft1;
					var delayTemp2Left = -delaySampleLeft2 + delaySampleLeft3;
					var delayTemp3Left = -delaySampleLeft2 - delaySampleLeft3;
					delayFeedback0Left += ((delayTemp0Left + delayTemp2Left) * reverb - delayFeedback0Left) * 0.5;
					delayFeedback1Left += ((delayTemp1Left + delayTemp3Left) * reverb - delayFeedback1Left) * 0.5;
					delayFeedback2Left += ((delayTemp0Left - delayTemp2Left) * reverb - delayFeedback2Left) * 0.5;
					delayFeedback3Left += ((delayTemp1Left - delayTemp3Left) * reverb - delayFeedback3Left) * 0.5;
					delayLineLeft[delayPos1Left] = delayFeedback0Left;
					delayLineLeft[delayPos2Left] = delayFeedback1Left;
					delayLineLeft[delayPos3Left] = delayFeedback2Left;
					delayLineLeft[delayPosLeft ] = delayFeedback3Left;
					delayPosLeft = (delayPosLeft + 1) & 0x3FFF;
					
					var delaySampleRight1 = delayLineRight[delayPos1Right];
					var delaySampleRight2 = delayLineRight[delayPos2Right];
					var delaySampleRight3 = delayLineRight[delayPos3Right];
					var delayTemp0Right = -delaySampleRight0 + delaySampleRight1;
					var delayTemp1Right = -delaySampleRight0 - delaySampleRight1;
					var delayTemp2Right = -delaySampleRight2 + delaySampleRight3;
					var delayTemp3Right = -delaySampleRight2 - delaySampleRight3;
					delayFeedback0Right += ((delayTemp0Right + delayTemp2Right) * reverb - delayFeedback0Right) * 0.5;
					delayFeedback1Right += ((delayTemp1Right + delayTemp3Right) * reverb - delayFeedback1Right) * 0.5;
					delayFeedback2Right += ((delayTemp0Right - delayTemp2Right) * reverb - delayFeedback2Right) * 0.5;
					delayFeedback3Right += ((delayTemp1Right - delayTemp3Right) * reverb - delayFeedback3Right) * 0.5;
					delayLineRight[delayPos1Right] = delayFeedback0Right;
					delayLineRight[delayPos2Right] = delayFeedback1Right;
					delayLineRight[delayPos3Right] = delayFeedback2Right;
					delayLineRight[delayPosRight ] = delayFeedback3Right;
					delayPosRight = (delayPosRight + 1) & 0x3FFF;
					
					var sampleLeft = delaySampleLeft0 + delaySampleLeft1 + delaySampleLeft2 + delaySampleLeft3
						+ channel#SampleLeft // NOISE
					;
					
					var sampleRight = delaySampleRight0 + delaySampleRight1 + delaySampleRight2 + delaySampleRight3
						+ channel#SampleRight // NOISE
					;
					
					var abs = sampleLeft < 0.0 ? -sampleLeft : sampleLeft;
					limit -= limitDecay;
					if (limit < abs) limit = abs;
					sampleLeft /= limit * 0.75 + 0.25;
					sampleLeft *= volume;
					sampleLeft = sampleLeft;
					dataLeft[bufferIndex] = sampleLeft;
					sampleRight /= limit * 0.75 + 0.25;
					sampleRight *= volume;
					sampleRight = sampleRight;
					dataRight[bufferIndex] = sampleRight;
					bufferIndex++;
					samples--;
				}
				
				synthChannel#.phases[0] = channel#PhaseA; // CHIP
				synthChannel#.phases[1] = channel#PhaseB; // CHIP
				synthChannel#.phases[0] = channel#Phase; // NOISE
				synthChannel#.phases[$] = channel#Operator$Phase / ` + Config.sineWaveLength + `; // FM
				synthChannel#.feedbackOutputs[$] = channel#Operator$Output; // FM
				synthChannel#.sampleLeft = channel#SampleLeft; // ALL
				synthChannel#.sampleRight = channel#SampleRight; // ALL
				
				synth.delayPosLeft = delayPosLeft;
				synth.delayFeedback0Left = delayFeedback0Left;
				synth.delayFeedback1Left = delayFeedback1Left;
				synth.delayFeedback2Left = delayFeedback2Left;
				synth.delayFeedback3Left = delayFeedback3Left;
				synth.delayPosRight = delayPosRight;
				synth.delayFeedback0Right = delayFeedback0Right;
				synth.delayFeedback1Right = delayFeedback1Right;
				synth.delayFeedback2Right = delayFeedback2Right;
				synth.delayFeedback3Right = delayFeedback3Right;
				synth.limit = limit;
				
				if (effectYMult * effectY - prevEffectY > prevEffectY) {
					synth.effectPhase = Math.asin(effectY);
				} else {
					synth.effectPhase = Math.PI - Math.asin(effectY);
				}
				
				if (synth.arpSampleCountdown == 0) {
					synth.arpeggio++;
					synth.arpSampleCountdown = samplesPerTick;
					if (synth.arpeggio == 4) {
						synth.arpeggio = 0;
						synth.part++;
						if (synth.part == song.partsPerBeat) {
							synth.part = 0;
							synth.beat++;
							if (synth.beat == song.beatsPerBar) {
								// The bar ended, may need to regenerate synthesizer.
								return bufferIndex;
							}
						}
					}
				}
			}
			
			// Indicate that the buffer is finished generating.
			return -1;
		`).split("\n");
    Synth.operatorSourceTemplate = (`
						var channel#Operator$PhaseMix = channel#Operator$Phase/* + channel#Operator@Scaled*/;
						var channel#Operator$PhaseInt = channel#Operator$PhaseMix|0;
						var channel#Operator$Index    = channel#Operator$PhaseInt & ` + Config.sineWaveMask + `;
						var channel#Operator$Sample   = sineWave[channel#Operator$Index];
						channel#Operator$Output       = channel#Operator$Sample + (sineWave[channel#Operator$Index + 1] - channel#Operator$Sample) * (channel#Operator$PhaseMix - channel#Operator$PhaseInt);
						var channel#Operator$Scaled   = channel#Operator$OutputMult * channel#Operator$Output;
		`).split("\n");

    const { button: button$a, div: div$a, input: input$6 } = HTML;
    function save(blob, name) {
        if (navigator.msSaveOrOpenBlob) {
            navigator.msSaveOrOpenBlob(blob, name);
            return;
        }
        const anchor = document.createElement("a");
        if (anchor.download != undefined) {
            const url = URL.createObjectURL(blob);
            setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
            anchor.href = url;
            anchor.download = name;
            setTimeout(function () { anchor.dispatchEvent(new MouseEvent("click")); }, 0);
        }
        else {
            const url = URL.createObjectURL(blob);
            setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
            if (!window.open(url, "_blank"))
                window.location.href = url;
        }
    }
    class ExportPrompt {
        constructor(_doc) {
            this._doc = _doc;
            this._fileName = input$6({ type: "text", style: "width: 10em;", value: "Modbox-Song", maxlength: 250 });
            this._enableIntro = input$6({ type: "checkbox" });
            this._loopDropDown = input$6({ style: "width: 2em;", type: "number", min: "1", max: "4", step: "1" });
            this._enableOutro = input$6({ type: "checkbox" });
            this._exportWavButton = button$a({}, [div$a("Export to .wav file")]);
            this._exportJsonButton = button$a({}, [div$a("Export to .json file")]);
            this._cancelButton = button$a({}, [div$a("Cancel")]);
            this.container = div$a({ class: "prompt", style: "width: 200px;" }, [
                div$a({ style: "font-size: 2em" }, [div$a("Export Options")]),
                div$a({ style: "display: flex; flex-direction: row; align-items: center; justify-content: space-between;" }, [
                    div$a("File name:"),
                    this._fileName,
                ]),
                div$a({ style: "display: table; width: 100%;" }, [
                    div$a({ style: "display: table-row;" }, [
                        div$a({ style: "display: table-cell;" }, [div$a("Intro:")]),
                        div$a({ style: "display: table-cell;" }, [div$a("Loop Count:")]),
                        div$a({ style: "display: table-cell;" }, [div$a("Outro:")]),
                    ]),
                    div$a({ style: "display: table-row;" }, [
                        div$a({ style: "display: table-cell; vertical-align: middle;" }, [this._enableIntro]),
                        div$a({ style: "display: table-cell; vertical-align: middle;" }, [this._loopDropDown]),
                        div$a({ style: "display: table-cell; vertical-align: middle;" }, [this._enableOutro]),
                    ]),
                ]),
                this._exportWavButton,
                this._exportJsonButton,
                this._cancelButton,
            ]);
            this._close = () => {
                this._doc.undo();
            };
            this.cleanUp = () => {
                this._fileName.removeEventListener("input", ExportPrompt._validateFileName);
                this._loopDropDown.removeEventListener("blur", ExportPrompt._validateNumber);
                this._exportWavButton.removeEventListener("click", this._whenExportToWav);
                this._exportJsonButton.removeEventListener("click", this._whenExportToJson);
                this._cancelButton.removeEventListener("click", this._close);
            };
            this._whenExportToWav = () => {
                const synth = new Synth(this._doc.song);
                synth.enableIntro = this._enableIntro.checked;
                synth.enableOutro = this._enableOutro.checked;
                synth.loopCount = Number(this._loopDropDown.value);
                if (!synth.enableIntro) {
                    for (let introIter = 0; introIter < this._doc.song.loopStart; introIter++) {
                        synth.nextBar();
                    }
                }
                const sampleFrames = synth.totalSamples;
                const recordedSamplesLeft = new Float32Array(sampleFrames);
                const recordedSamplesRight = new Float32Array(sampleFrames);
                synth.synthesize(recordedSamplesLeft, recordedSamplesRight, sampleFrames);
                const wavChannelCount = 2;
                const sampleRate = synth.samplesPerSecond;
                const bytesPerSample = 2;
                const bitsPerSample = 8 * bytesPerSample;
                const sampleCount = wavChannelCount * sampleFrames;
                const totalFileSize = 44 + sampleCount * bytesPerSample;
                let index = 0;
                const arrayBuffer = new ArrayBuffer(totalFileSize);
                const data = new DataView(arrayBuffer);
                data.setUint32(index, 0x52494646, false);
                index += 4;
                data.setUint32(index, 36 + sampleCount * bytesPerSample, true);
                index += 4;
                data.setUint32(index, 0x57415645, false);
                index += 4;
                data.setUint32(index, 0x666D7420, false);
                index += 4;
                data.setUint32(index, 0x00000010, true);
                index += 4;
                data.setUint16(index, 0x0001, true);
                index += 2;
                data.setUint16(index, wavChannelCount, true);
                index += 2;
                data.setUint32(index, sampleRate, true);
                index += 4;
                data.setUint32(index, sampleRate * bytesPerSample * wavChannelCount, true);
                index += 4;
                data.setUint16(index, bytesPerSample, true);
                index += 2;
                data.setUint16(index, bitsPerSample, true);
                index += 2;
                data.setUint32(index, 0x64617461, false);
                index += 4;
                data.setUint32(index, sampleCount * bytesPerSample, true);
                index += 4;
                let stride;
                let repeat;
                {
                    stride = 1;
                    repeat = 1;
                }
                let valLeft;
                let valRight;
                {
                    for (let i = 0; i < sampleFrames; i++) {
                        valLeft = Math.floor(recordedSamplesLeft[i * stride] * ((1 << (bitsPerSample - 1)) - 1));
                        valRight = Math.floor(recordedSamplesRight[i * stride] * ((1 << (bitsPerSample - 1)) - 1));
                        for (let k = 0; k < repeat; k++) {
                            {
                                data.setInt16(index, valLeft, true);
                                index += 2;
                                data.setInt16(index, valRight, true);
                                index += 2;
                            }
                        }
                    }
                }
                const blob = new Blob([arrayBuffer], { type: "audio/wav" });
                save(blob, this._fileName.value.trim() + ".wav");
                this._close();
            };
            this._whenExportToJson = () => {
                const jsonObject = this._doc.song.toJsonObject(this._enableIntro.checked, Number(this._loopDropDown.value), this._enableOutro.checked);
                const jsonString = JSON.stringify(jsonObject, null, '\t');
                const blob = new Blob([jsonString], { type: "application/json" });
                save(blob, this._fileName.value.trim() + ".json");
                this._close();
            };
            this._loopDropDown.value = "1";
            if (this._doc.song.loopStart == 0) {
                this._enableIntro.checked = false;
                this._enableIntro.disabled = true;
            }
            else {
                this._enableIntro.checked = true;
                this._enableIntro.disabled = false;
            }
            if (this._doc.song.loopStart + this._doc.song.loopLength == this._doc.song.barCount) {
                this._enableOutro.checked = false;
                this._enableOutro.disabled = true;
            }
            else {
                this._enableOutro.checked = true;
                this._enableOutro.disabled = false;
            }
            this._fileName.addEventListener("input", ExportPrompt._validateFileName);
            this._loopDropDown.addEventListener("blur", ExportPrompt._validateNumber);
            this._exportWavButton.addEventListener("click", this._whenExportToWav);
            this._exportJsonButton.addEventListener("click", this._whenExportToJson);
            this._cancelButton.addEventListener("click", this._close);
        }
        static _validateFileName(event) {
            const input = event.target;
            const deleteChars = /[\+\*\$\?\|\{\}\\\/<>#%!`&'"=:@]/gi;
            if (deleteChars.test(input.value)) {
                let cursorPos = input.selectionStart;
                input.value = input.value.replace(deleteChars, "");
                cursorPos--;
                input.setSelectionRange(cursorPos, cursorPos);
            }
        }
        static _validateNumber(event) {
            const input = event.target;
            input.value = Math.floor(Math.max(Number(input.min), Math.min(Number(input.max), Number(input.value)))) + "";
        }
    }

    const { button: button$9, div: div$9, input: input$5 } = HTML;
    class ImportPrompt {
        constructor(_doc) {
            this._doc = _doc;
            this._fileInput = input$5({ type: "file", accept: ".json,application/json" });
            this._cancelButton = button$9({}, [div$9("Cancel")]);
            this.container = div$9({ class: "prompt", style: "width: 200px;" }, [
                div$9({ style: "font-size: 2em" }, [div$9("Import")]),
                div$9({ style: "text-align: left;" }, [div$9("BeepBox songs can be exported and re-imported as .json files. You could also use other means to make .json files for BeepBox as long as they follow the same structure.")]),
                this._fileInput,
                this._cancelButton,
            ]);
            this._close = () => {
                this._doc.undo();
            };
            this.cleanUp = () => {
                this._fileInput.removeEventListener("change", this._whenFileSelected);
                this._cancelButton.removeEventListener("click", this._close);
            };
            this._whenFileSelected = () => {
                const file = this._fileInput.files[0];
                if (!file)
                    return;
                const reader = new FileReader();
                reader.addEventListener("load", (event) => {
                    this._doc.prompt = null;
                    this._doc.record(new ChangeSong(this._doc, reader.result), true);
                });
                reader.readAsText(file);
            };
            this._fileInput.addEventListener("change", this._whenFileSelected);
            this._cancelButton.addEventListener("click", this._close);
        }
    }

    const { button: button$8, div: div$8, a: a$2 } = HTML;
    class ArchivePrompt {
        constructor(_doc) {
            this._doc = _doc;
            this._cancelButton = button$8({}, div$8("No thanks!"));
            this.container = div$8({ class: "prompt", style: "width: 250px;" }, div$8({ style: "font-size: 2em" }, div$8("Archives")), div$8({ style: "text-align: center;" }, div$8('These are the Archives. Below are previous versions of Modded Beepbox/Sandbox that you are able to play around with, changelog included. Go nuts!')), div$8({ style: "text-align: center;" }, a$2({ target: "_blank", href: "https://moddedbeepbox.github.io/beta/mb-archives/1.3.0.htm" }, div$8("MB 1.3.0")), div$8(" | "), a$2({ target: "_blank", href: "https://moddedbeepbox.github.io/beta/mb-archives/1.6.0.htm" }, div$8("MB 1.6.0")), div$8(" | "), a$2({ target: "_blank", href: "https://moddedbeepbox.github.io/beta/mb-archives/1.9.1.htm" }, div$8("MB 1.9.1")), div$8(" | "), a$2({ target: "_blank", href: "https://moddedbeepbox.github.io/beta/mb-archives/2.0.0.htm" }, div$8("MB v2.0.0")), div$8(" | "), a$2({ target: "_blank", href: "https://moddedbeepbox.github.io/beta/mb-archives/2.3.0.htm" }, div$8("MB v2.2.2")), div$8(" | "), a$2({ target: "_blank", href: "https://moddedbeepbox.github.io/beta/mb-archives/2.3.html" }, div$8("MB v2.3.0")), div$8(" | "), a$2({ target: "_blank", href: "https://moddedbeepbox.github.io/beta/mb-archives/3.0.html" }, div$8("MB v3.0.3")), div$8(" | "), a$2({ target: "_blank", href: "https://moddedbeepbox.github.io/beta/sb-archives/1.2.1.htm" }, div$8("SB v1.2.1")), div$8(" | "), a$2({ target: "_blank", href: "https://moddedbeepbox.github.io/beta/sb-archives/1.3.0.htm" }, div$8("SB v1.3.0")), div$8(" | "), a$2({ target: "_blank", href: "https://moddedbeepbox.github.io/beta/sb-archives/1.4.0.htm" }, div$8("SB v1.4.0")), div$8(" | "), a$2({ target: "_blank", href: "https://moddedbeepbox.github.io/beta/sb-archives/2.0.6.1.htm" }, div$8("SB v2.0.6.1")), div$8(" | "), a$2({ target: "_blank", href: "https://moddedbeepbox.github.io/beta/sb-archives/2.1.3.htm" }, div$8("SB v2.1.3")), div$8(" | "), a$2({ target: "_blank", href: "https://moddedbeepbox.github.io/beta/sb-archives/3.0.0.htm" }, div$8("SB v3.0.0")), div$8(" | "), a$2({ target: "_blank", href: "https://moddedbeepbox.github.io/beta/changelogs/mbchangelog.html" }, div$8("Changelog"))), this._cancelButton);
            this._close = () => {
                this._doc.undo();
            };
            this.cleanUp = () => {
                this._cancelButton.removeEventListener("click", this._close);
            };
            this._cancelButton.addEventListener("click", this._close);
        }
    }

    const { button: button$7, div: div$7 } = HTML;
    class SongDataPrompt {
        constructor(_doc) {
            this._doc = _doc;
            this._cancelButton = button$7({}, [div$7("Close")]);
            this.container = div$7({ class: "prompt", style: "width: 250px;" }, [
                div$7({ style: "font-size: 2em" }, [div$7("Song Data")]),
                div$7({ style: "text-align: left;" }, [div$7('You are on update Modbox 3.3.0-B_1.')]),
                div$7({ style: "text-align: left;" }, [div$7('Your song is ' + this._doc.synth.totalSeconds + ' seconds long.')]),
                div$7({ style: "text-align: left;" }, [div$7('Your song runs at ' + this._doc.song.getBeatsPerMinute() + ' beats per minute.')]),
                div$7({ style: "text-align: left;" }, [div$7('There are currently ' + this._doc.song.getChannelUnusedCount() + ' unused channels in your song out of 16.')]),
                div$7({ style: "text-align: left;" }, [div$7(this._doc.song.setSongTheme == "none" ? 'You are using your personal theme.' : 'Your are using the ' + this._doc.song.setSongTheme + ' theme.')]),
                div$7({ style: "text-align: left;" }, [div$7('Your time signuature is ' + this._doc.song.getTimeSig())]),
                div$7({ style: "text-align: left;" }, [div$7('Your scale is ' + this._doc.song.getScaleNKey() + '.')]),
                this._cancelButton,
            ]);
            this._close = () => {
                this._doc.undo();
            };
            this.cleanUp = () => {
                this._cancelButton.removeEventListener("click", this._close);
            };
            this._cancelButton.addEventListener("click", this._close);
        }
    }

    const { button: button$6, div: div$6 } = HTML;
    class RefreshKeyPrompt {
        constructor(_doc, _songEditor, _newKeyValue) {
            this._doc = _doc;
            this._songEditor = _songEditor;
            this._newKeyValue = _newKeyValue;
            this._refreshButton = button$6({}, [div$6("Refresh")]);
            this.container = div$6({ class: "prompt", style: "width: 200px;" }, [
                div$6({ style: "font-size: 1em" }, [div$6("Refresh")]),
                div$6({ style: "text-align: left; margin: 0.5em 0;" }, [
                    div$6("Due to you using the Piano theme, you will need to refresh to display the change in key colors.")
                ]),
                div$6({ style: "text-align: left; margin: 0.5em 0;" }, [
                    div$6("You must refresh to continue.")
                ]),
                this._refreshButton,
            ]);
            this._saveChangesAndRefresh = () => {
                this._doc.prompt = null;
                this._doc.record(new ChangeKey(this._doc, this._newKeyValue));
                this._songEditor.refreshNow();
            };
            this.cleanUp = () => {
                this._refreshButton.addEventListener("click", this._saveChangesAndRefresh);
            };
            this._refreshButton.addEventListener("click", this._saveChangesAndRefresh);
        }
    }

    const { button: button$5, div: div$5, input: input$4, span: span$1 } = HTML;
    class SongDurationPrompt {
        constructor(_doc) {
            this._doc = _doc;
            this._beatsStepper = input$4({ style: "width: 3em; margin-left: 1em;", type: "number", step: "1" });
            this._barsStepper = input$4({ style: "width: 3em; margin-left: 1em;", type: "number", step: "1" });
            this._patternsStepper = input$4({ style: "width: 3em; margin-left: 1em;", type: "number", step: "1" });
            this._instrumentsStepper = input$4({ style: "width: 3em; margin-left: 1em;", type: "number", step: "1" });
            this._pitchChannelStepper = input$4({ style: "width: 3em; margin-left: 1em;", type: "number", step: "1" });
            this._drumChannelStepper = input$4({ style: "width: 3em; margin-left: 1em;", type: "number", step: "1" });
            this._okayButton = button$5({ style: "width:45%;" }, [div$5("Okay")]);
            this._cancelButton = button$5({ style: "width:45%;" }, [div$5("Cancel")]);
            this.container = div$5({ class: "prompt", style: "width: 250px;" }, [
                div$5({ style: "font-size: 2em" }, [div$5("Custom Song Size")]),
                div$5({ style: "display: flex; flex-direction: row; align-items: center; height: 2em; justify-content: flex-end;" }, [
                    div$5({ style: "text-align: right;" }, [
                        div$5("Beats per bar:"),
                        span$1({ style: "font-size: smaller; color: #888888;" }, [div$5("(Multiples of 3 or 4 are recommended)")]),
                    ]),
                    this._beatsStepper,
                ]),
                div$5({ style: "display: flex; flex-direction: row; align-items: center; height: 2em; justify-content: flex-end;" }, [
                    div$5({ style: "display: inline-block; text-align: right;" }, [
                        div$5("Bars per song:"),
                        span$1({ style: "font-size: smaller; color: #888888;" }, [div$5("(Multiples of 2 or 4 are recommended)")]),
                    ]),
                    this._barsStepper,
                ]),
                div$5({ style: "display: flex; flex-direction: row; align-items: center; height: 2em; justify-content: flex-end;" }, [
                    div$5("Patterns per channel:"),
                    this._patternsStepper,
                ]),
                div$5({ style: "display: flex; flex-direction: row; align-items: center; height: 2em; justify-content: flex-end;" }, [
                    div$5("Instruments per channel:"),
                    this._instrumentsStepper,
                ]),
                div$5({ style: "display: flex; flex-direction: row; align-items: center; height: 2em; justify-content: flex-end;" }, [
                    div$5("Number of pitch channels:"),
                    this._pitchChannelStepper,
                ]),
                div$5({ style: "display: flex; flex-direction: row; align-items: center; height: 2em; justify-content: flex-end;" }, [
                    div$5("Number of drum channels:"),
                    this._drumChannelStepper,
                ]),
                div$5({ style: "display: flex; flex-direction: row; justify-content: space-between;" }, [
                    this._okayButton,
                    this._cancelButton,
                ]),
            ]);
            this._close = () => {
                this._doc.undo();
            };
            this.cleanUp = () => {
                this._okayButton.removeEventListener("click", this._saveChanges);
                this._cancelButton.removeEventListener("click", this._close);
                this._beatsStepper.removeEventListener("keypress", SongDurationPrompt._validateKey);
                this._barsStepper.removeEventListener("keypress", SongDurationPrompt._validateKey);
                this._patternsStepper.removeEventListener("keypress", SongDurationPrompt._validateKey);
                this._instrumentsStepper.removeEventListener("keypress", SongDurationPrompt._validateKey);
                this._pitchChannelStepper.removeEventListener("keypress", SongDurationPrompt._validateKey);
                this._drumChannelStepper.removeEventListener("keypress", SongDurationPrompt._validateKey);
                this._beatsStepper.removeEventListener("blur", SongDurationPrompt._validateNumber);
                this._barsStepper.removeEventListener("blur", SongDurationPrompt._validateNumber);
                this._patternsStepper.removeEventListener("blur", SongDurationPrompt._validateNumber);
                this._instrumentsStepper.removeEventListener("blur", SongDurationPrompt._validateNumber);
                this._pitchChannelStepper.removeEventListener("blur", SongDurationPrompt._validateNumber);
                this._drumChannelStepper.removeEventListener("blur", SongDurationPrompt._validateNumber);
            };
            this._saveChanges = () => {
                const group = new ChangeGroup();
                group.append(new ChangeBeatsPerBar(this._doc, SongDurationPrompt._validate(this._beatsStepper)));
                group.append(new ChangeBarCount(this._doc, SongDurationPrompt._validate(this._barsStepper)));
                group.append(new ChangePatternsPerChannel(this._doc, SongDurationPrompt._validate(this._patternsStepper)));
                group.append(new ChangeInstrumentsPerChannel(this._doc, SongDurationPrompt._validate(this._instrumentsStepper)));
                group.append(new ChangeChannelCount(this._doc, SongDurationPrompt._validate(this._pitchChannelStepper), SongDurationPrompt._validate(this._drumChannelStepper)));
                this._doc.prompt = null;
                this._doc.record(group, true);
            };
            this._beatsStepper.value = this._doc.song.beatsPerBar + "";
            this._beatsStepper.min = Config.beatsPerBarMin + "";
            this._beatsStepper.max = Config.beatsPerBarMax + "";
            this._barsStepper.value = this._doc.song.barCount + "";
            this._barsStepper.min = Config.barCountMin + "";
            this._barsStepper.max = Config.barCountMax + "";
            this._patternsStepper.value = this._doc.song.patternsPerChannel + "";
            this._patternsStepper.min = Config.patternsPerChannelMin + "";
            this._patternsStepper.max = Config.patternsPerChannelMax + "";
            this._instrumentsStepper.value = this._doc.song.instrumentsPerChannel + "";
            this._instrumentsStepper.min = Config.instrumentsPerChannelMin + "";
            this._instrumentsStepper.max = Config.instrumentsPerChannelMax + "";
            this._pitchChannelStepper.value = this._doc.song.pitchChannelCount + "";
            this._pitchChannelStepper.min = Config.pitchChannelCountMin + "";
            this._pitchChannelStepper.max = Config.pitchChannelCountMax + "";
            this._drumChannelStepper.value = this._doc.song.drumChannelCount + "";
            this._drumChannelStepper.min = Config.drumChannelCountMin + "";
            this._drumChannelStepper.max = Config.drumChannelCountMax + "";
            this._okayButton.addEventListener("click", this._saveChanges);
            this._cancelButton.addEventListener("click", this._close);
            this._beatsStepper.addEventListener("keypress", SongDurationPrompt._validateKey);
            this._barsStepper.addEventListener("keypress", SongDurationPrompt._validateKey);
            this._patternsStepper.addEventListener("keypress", SongDurationPrompt._validateKey);
            this._instrumentsStepper.addEventListener("keypress", SongDurationPrompt._validateKey);
            this._pitchChannelStepper.addEventListener("keypress", SongDurationPrompt._validateKey);
            this._drumChannelStepper.addEventListener("keypress", SongDurationPrompt._validateKey);
            this._beatsStepper.addEventListener("blur", SongDurationPrompt._validateNumber);
            this._barsStepper.addEventListener("blur", SongDurationPrompt._validateNumber);
            this._patternsStepper.addEventListener("blur", SongDurationPrompt._validateNumber);
            this._instrumentsStepper.addEventListener("blur", SongDurationPrompt._validateNumber);
            this._pitchChannelStepper.addEventListener("blur", SongDurationPrompt._validateNumber);
            this._drumChannelStepper.addEventListener("blur", SongDurationPrompt._validateNumber);
        }
        static _validateKey(event) {
            const charCode = (event.which) ? event.which : event.keyCode;
            if (charCode != 46 && charCode > 31 && (charCode < 48 || charCode > 57)) {
                event.preventDefault();
                return true;
            }
            return false;
        }
        static _validateNumber(event) {
            const input = event.target;
            input.value = Math.floor(Math.max(Number(input.min), Math.min(Number(input.max), Number(input.value)))) + "";
        }
        static _validate(input) {
            return Math.floor(Number(input.value));
        }
    }

    const { button: button$4, div: div$4, a: a$1 } = HTML;
    class InstrumentTypePrompt {
        constructor(_doc) {
            this._doc = _doc;
            this._cancelButton = button$4({}, [div$4("Close")]);
            this.container = div$4({ class: "prompt", style: "width: 300px;" }, [
                div$4({ style: "font-size: 2em" }, [div$4("FM Synthesis")]),
                div$4({ style: "text-align: left; margin: 0.5em 0;" }, [
                    div$4('Popularized by the Sega Genesis and Yamaha keyboards, FM Synthesis is a mysterious but powerful technique for crafting sounds. It may seem confusing, but just play around with the options until you get a feel for it, check out some examples in '),
                    a$1({ target: "_blank", href: "#6n10s0kbl00e07t5m0a7g07j7i7r1o2T1d2c0A0F1B0V1Q0200Pff00E0411T1d1c0A0F0B0V1Q2800Pf700E0711T1d2c0A0F1B4VaQ0200Pfb00E0911T1d1c2A0F9B3V1Q1000Pfbc0E0191T1d2c0AcF8B5V1Q0259PffffE0000T1d3c1AcF4B5V4Q2600Pff00E0011T1d1c0AbF0B0V1Q2580PfffaE2226T1d1c0A1F0B0V1Q520dPff4dEd41eb4zhmu0p21h5dfxd7ij7XrjfiAjPudUTtUSRsTzudTudJvdUTztTzrpPudUTtUSSYTzudTudJTdUTztTzrvPudUTtUSQ" }, [div$4("this demo")]),
                    div$4(", or find some instruments to use in the Beepbox Discord's FM sheet "),
                    a$1({ target: "_blank", href: "https://docs.google.com/spreadsheets/d/1ddbXnrP7yvv5X4oUur9boi3AxcI-Xxz1XIHIAo-wi0s/edit#gid=230623845" }, [div$4("right here")]),
                    div$4(".")
                ]),
                div$4({ style: "text-align: left; margin: 0.5em 0;" }, [div$4('This FM instrument uses up to four waves, numbered 1, 2, 3, and 4. ' +
                        'Each wave may have its own frequency, volume, and volume envelope to control its effect over time. ')]),
                div$4({ style: "text-align: left; margin: 0.5em 0;" }, [div$4('There are two kinds of waves: "carrier" waves play a tone out loud, but "modulator" waves distort other waves instead. ' +
                        'Wave 1 is always a carrier and plays a tone, but other waves may distort it. ' +
                        'The "Algorithm" setting determines which waves are modulators, and which other waves those modulators distort. ')]),
                div$4({ style: "text-align: left; margin: 0.5em 0;" }, [div$4('Modulators distort in one direction (like 1←2), but you can also use "Feedback" to make any wave distort in the opposite direction (1→2), in both directions (1🗘2), or even itself (1⟲). ')]),
                div$4({ style: "text-align: left; margin: 0.5em 0;" }, [div$4('You can set the pitch of each wave independently by adding simultaneous notes, one above another. This often sounds harsh or dissonant, but can make cool sound effects! ')]),
                this._cancelButton,
            ]);
            this._close = () => {
                this._doc.undo();
            };
            this.cleanUp = () => {
                this._cancelButton.removeEventListener("click", this._close);
            };
            this._cancelButton.addEventListener("click", this._close);
        }
    }

    const { button: button$3, div: div$3, form: form$2, label: label$2, input: input$3 } = HTML;
    class ThemePrompt {
        constructor(_doc) {
            this._doc = _doc;
            this.hasChanged = false;
            this._closeButton = button$3({ style: "flex: 1; width: 0;" }, "Close");
            this._previewButton = button$3({ style: "flex: 1; width: 0;" }, "Preview");
            this._previewText = div$3({ style: "opacity: 0; position:absolute; left: 8px; top: 24px; font-size: 32px; font-weight:bold;" }, "Previewing...");
            this.previewExit = div$3({ style: "width: 100vw; height: 100vh; position: fixed; left: 0; top: -2vh; display: flex; pointer-events: none;" }, this._previewText);
            this._form = form$2({ style: "display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; max-height:265px; overflow-y: scroll; overflow-x: hidden;" }, label$2({ title: "Default", class: "theme-option" }, input$3({ type: "radio", name: "theme", value: "default", style: "display:none;" }), div$3({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$3({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$3({ style: "width: 58px; height: 58px; background: #606060; border-radius: 35px;" })), div$3({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Default"))), label$2({ title: "NepBox", class: "theme-option" }, input$3({ type: "radio", name: "theme", value: "nepbox", style: "display:none;" }), div$3({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$3({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$3({ style: "width: 58px; height: 58px; background: #9150ff; border-radius: 35px;" })), div$3({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "NepBox"))), label$2({ title: "Laffey", class: "theme-option" }, input$3({ type: "radio", name: "theme", value: "laffey", style: "display:none;" }), div$3({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$3({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$3({ style: "width: 58px; height: 58px; background: #dbbeed; border-radius: 35px;" })), div$3({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Laffey"))), label$2({ title: "ModBox 2.0", class: "theme-option" }, input$3({ type: "radio", name: "theme", value: "modbox2", style: "display:none;" }), div$3({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$3({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$3({ style: "width: 58px; height: 58px; background: #c4ffa3; border-radius: 35px;" })), div$3({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "ModBox 2.0"))), label$2({ title: "Artic", class: "theme-option" }, input$3({ type: "radio", name: "theme", value: "artic", style: "display:none;" }), div$3({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$3({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$3({ style: "width: 58px; height: 58px; background: #a5eeff; border-radius: 35px;" })), div$3({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Artic"))), label$2({ title: "Cinnamon Roll [!]", class: "theme-option" }, input$3({ type: "radio", name: "theme", value: "Cinnamon Roll", style: "display:none;" }), div$3({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$3({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$3({ style: "width: 58px; height: 58px; background: #f5bb00; border-radius: 35px;" })), div$3({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "CinnaBun [!]"))), label$2({ title: "Ocean", class: "theme-option" }, input$3({ type: "radio", name: "theme", value: "Ocean", style: "display:none;" }), div$3({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$3({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$3({ style: "width: 58px; height: 58px; background: #4449a3; border-radius: 35px;" })), div$3({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Ocean"))), label$2({ title: "Rainbow [!]", class: "theme-option" }, input$3({ type: "radio", name: "theme", value: "rainbow", style: "display:none;" }), div$3({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$3({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$3({ style: "width: 58px; height: 58px; background: linear-gradient(140deg, #faa, #ffceaa, #ffdfaa, #fff5aa, #e8ffaa, #bfffb2, #b2ffc8, #b2ffe4, #b2b3ff, #e0b2ff, #ffafe9); border-radius: 35px;" })), div$3({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Rainbow [!]"))), label$2({ title: "Float", class: "theme-option" }, input$3({ type: "radio", name: "theme", value: "float", style: "display:none;" }), div$3({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$3({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$3({ style: "width: 58px; height: 58px; background: linear-gradient(140deg, #fff, #282828); border-radius: 35px;" })), div$3({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Float [!]"))), label$2({ title: "Windows", class: "theme-option" }, input$3({ type: "radio", name: "theme", value: "windows", style: "display:none;" }), div$3({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$3({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$3({ style: "width: 58px; height: 58px; background: #295294; border-radius: 35px;" })), div$3({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Windows"))), label$2({ title: "Grassland", class: "theme-option" }, input$3({ type: "radio", name: "theme", value: "grassland", style: "display:none;" }), div$3({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$3({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$3({ style: "width: 58px; height: 58px; background: #74bc21; border-radius: 35px;" })), div$3({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Grassland"))), label$2({ title: "Dessert", class: "theme-option" }, input$3({ type: "radio", name: "theme", value: "dessert", style: "display:none;" }), div$3({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$3({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$3({ style: "width: 58px; height: 58px; background: #fffc5b; border-radius: 35px;" })), div$3({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Dessert"))), label$2({ title: "Kahootiest", class: "theme-option" }, input$3({ type: "radio", name: "theme", value: "kahootiest", style: "display:none;" }), div$3({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$3({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$3({ style: "width: 58px; height: 58px; background: #864cbf; border-radius: 35px;" })), div$3({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Kahoot"))), label$2({ title: "Beam to the Bit [!]", class: "theme-option" }, input$3({ type: "radio", name: "theme", value: "beambit", style: "display:none;" }), div$3({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$3({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$3({ style: "width: 58px; height: 58px; background: #fa0103; border-radius: 35px;" })), div$3({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Beambit [!]"))), label$2({ title: "Pretty Egg", class: "theme-option" }, input$3({ type: "radio", name: "theme", value: "egg", style: "display:none;" }), div$3({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$3({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$3({ style: "width: 58px; height: 58px; background: #ffb1f4; border-radius: 35px;" })), div$3({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Pretty Egg"))), label$2({ title: "Poniryoshka", class: "theme-option" }, input$3({ type: "radio", name: "theme", value: "Poniryoshka", style: "display:none;" }), div$3({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$3({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$3({ style: "width: 58px; height: 58px; background: #dabbe6; border-radius: 35px;" })), div$3({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Poni"))), label$2({ title: "Gameboy [!]", class: "theme-option" }, input$3({ type: "radio", name: "theme", value: "gameboy", style: "display:none;" }), div$3({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$3({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$3({ style: "width: 58px; height: 58px; background: #306230; border-radius: 35px;" })), div$3({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Gameboy [!]"))), label$2({ title: "Woodkid", class: "theme-option" }, input$3({ type: "radio", name: "theme", value: "woodkid", style: "display:none;" }), div$3({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$3({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$3({ style: "width: 58px; height: 58px; background: #41323b; border-radius: 35px;" })), div$3({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Woodkid"))), label$2({ title: "Midnight", class: "theme-option" }, input$3({ type: "radio", name: "theme", value: "midnight", style: "display:none;" }), div$3({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$3({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$3({ style: "width: 58px; height: 58px; background: #445566; border-radius: 35px;" })), div$3({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Midnight"))), label$2({ title: "Snedbox", class: "theme-option" }, input$3({ type: "radio", name: "theme", value: "snedbox", style: "display:none;" }), div$3({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$3({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$3({ style: "width: 58px; height: 58px; background: #10997e; border-radius: 35px;" })), div$3({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Snedbox"))), label$2({ title: "unnamed", class: "theme-option" }, input$3({ type: "radio", name: "theme", value: "unnamed", style: "display:none;" }), div$3({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$3({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$3({ style: "width: 58px; height: 58px; background: #ffffa0; border-radius: 35px;" })), div$3({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "unnamed"))), label$2({ title: "Piano", class: "theme-option" }, input$3({ type: "radio", name: "theme", value: "piano", style: "display:none;" }), div$3({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$3({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$3({ style: "width: 58px; height: 58px; background: #bfbfbf; border-radius: 35px;" })), div$3({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Piano [!]"))), label$2({ title: "Halloween", class: "theme-option" }, input$3({ type: "radio", name: "theme", value: "halloween", style: "display:none;" }), div$3({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$3({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$3({ style: "width: 58px; height: 58px; background: #914300; border-radius: 35px;" })), div$3({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Halloween"))), label$2({ title: "FrozenOver❄️", class: "theme-option" }, input$3({ type: "radio", name: "theme", value: "frozen", style: "display:none;" }), div$3({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$3({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$3({ style: "width: 58px; height: 58px; background: #99c8ef; border-radius: 35px;" })), div$3({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Frozen"))));
            this.themeContainer = div$3({ class: "prompt", style: "width: 330px; max-height: 600px;" }, div$3({ style: "font-size: 2em" }, div$3("Themes")), this._form, div$3({ style: "display:flex; flex-direction:row; width:100%; gap: 16px;" }, this._previewButton, this._closeButton));
            this.container = div$3({}, this.themeContainer, this.previewExit);
            this._close = () => {
                if (this.hasChanged == false) {
                    if (window.localStorage.getItem("modboxTheme")) {
                        ColorConfig.setTheme(String(window.localStorage.getItem("modboxTheme")));
                    }
                    else {
                        ColorConfig.setTheme("default");
                    }
                    this._doc.prompt = null;
                    this._doc.undo();
                }
                else {
                    window.localStorage.setItem("modboxTheme", this._form.elements["theme"].value);
                    this._doc.prompt = null;
                    this._doc.undo();
                }
            };
            this._themeChange = () => {
                ColorConfig.setTheme(this._form.elements["theme"].value);
                if (this._form.elements["theme"].value != window.localStorage.getItem("modboxTheme")) {
                    this.hasChanged = true;
                    this._closeButton.innerHTML = "Save";
                }
                else {
                    this.hasChanged = false;
                    this._closeButton.innerHTML = "Cancel";
                }
            };
            this._previewTheme = () => {
                this.themeContainer.style.opacity = "0";
                this.previewExit.style.pointerEvents = "";
                this._previewText.style.opacity = "1";
            };
            this._exitPreview = () => {
                this.themeContainer.style.opacity = "1";
                this.previewExit.style.pointerEvents = "none";
                this._previewText.style.opacity = "0";
            };
            this.cleanUp = () => {
                this._closeButton.removeEventListener("click", this._close);
            };
            this._closeButton.addEventListener("click", this._close);
            this._previewButton.addEventListener("click", this._previewTheme);
            this.previewExit.addEventListener("click", this._exitPreview);
            this._form.addEventListener("change", this._themeChange);
            if (window.localStorage.getItem("modboxTheme") != null) {
                this._form.elements["theme"].value = window.localStorage.getItem("modboxTheme");
            }
        }
    }

    const { button: button$2, div: div$2, form: form$1, label: label$1, input: input$2 } = HTML;
    class SongThemePrompt {
        constructor(_doc) {
            this._doc = _doc;
            this.hasChanged = false;
            this._closeButton = button$2({ style: "flex: 1; width: 0;" }, "Close");
            this._previewButton = button$2({ style: "flex: 1; width: 0;" }, "Preview");
            this._previewText = div$2({ style: "opacity: 0; position:absolute; left: 8px; top: 24px; font-size: 32px; font-weight:bold;" }, "Previewing...");
            this.previewExit = div$2({ style: "width: 100vw; height: 100vh; position: fixed; left: 0; top: -2vh; display: flex; pointer-events: none;" }, this._previewText);
            this._form = form$1({ style: "display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; max-height:265px; overflow-y: scroll; overflow-x: hidden;" }, label$1({ title: "None", class: "theme-option" }, input$2({ type: "radio", name: "theme", value: "none", style: "display:none;" }), div$2({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$2({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$2({ style: "width: 58px; height: 58px; background:rgb(0, 0, 0); border-radius: 35px;" })), div$2({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "None"))), label$1({ title: "Default", class: "theme-option" }, input$2({ type: "radio", name: "theme", value: "default", style: "display:none;" }), div$2({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$2({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$2({ style: "width: 58px; height: 58px; background: #606060; border-radius: 35px;" })), div$2({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Default"))), label$1({ title: "Laffey", class: "theme-option" }, input$2({ type: "radio", name: "theme", value: "laffey", style: "display:none;" }), div$2({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$2({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$2({ style: "width: 58px; height: 58px; background: #dbbeed; border-radius: 35px;" })), div$2({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Laffey"))), label$1({ title: "NepBox", class: "theme-option" }, input$2({ type: "radio", name: "theme", value: "nepbox", style: "display:none;" }), div$2({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$2({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$2({ style: "width: 58px; height: 58px; background: #9150ff; border-radius: 35px;" })), div$2({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "NepBox"))), label$1({ title: "ModBox 2.0", class: "theme-option" }, input$2({ type: "radio", name: "theme", value: "modbox2", style: "display:none;" }), div$2({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$2({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$2({ style: "width: 58px; height: 58px; background: #c4ffa3; border-radius: 35px;" })), div$2({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "ModBox 2.0"))), label$1({ title: "Artic", class: "theme-option" }, input$2({ type: "radio", name: "theme", value: "artic", style: "display:none;" }), div$2({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$2({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$2({ style: "width: 58px; height: 58px; background: #a5eeff; border-radius: 35px;" })), div$2({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Artic"))), label$1({ title: "Cinnamon Roll [!]", class: "theme-option" }, input$2({ type: "radio", name: "theme", value: "Cinnamon Roll", style: "display:none;" }), div$2({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$2({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$2({ style: "width: 58px; height: 58px; background: #f5bb00; border-radius: 35px;" })), div$2({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "CinnaBun [!]"))), label$1({ title: "Ocean", class: "theme-option" }, input$2({ type: "radio", name: "theme", value: "Ocean", style: "display:none;" }), div$2({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$2({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$2({ style: "width: 58px; height: 58px; background: #4449a3; border-radius: 35px;" })), div$2({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Ocean"))), label$1({ title: "Rainbow [!]", class: "theme-option" }, input$2({ type: "radio", name: "theme", value: "rainbow", style: "display:none;" }), div$2({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$2({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$2({ style: "width: 58px; height: 58px; background: linear-gradient(140deg, #faa, #ffceaa, #ffdfaa, #fff5aa, #e8ffaa, #bfffb2, #b2ffc8, #b2ffe4, #b2b3ff, #e0b2ff, #ffafe9); border-radius: 35px;" })), div$2({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Rainbow [!]"))), label$1({ title: "Float", class: "theme-option" }, input$2({ type: "radio", name: "theme", value: "float", style: "display:none;" }), div$2({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$2({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$2({ style: "width: 58px; height: 58px; background: linear-gradient(140deg, #fff, #282828); border-radius: 35px;" })), div$2({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Float [!]"))), label$1({ title: "Windows", class: "theme-option" }, input$2({ type: "radio", name: "theme", value: "windows", style: "display:none;" }), div$2({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$2({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$2({ style: "width: 58px; height: 58px; background: #295294; border-radius: 35px;" })), div$2({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Windows"))), label$1({ title: "Grassland", class: "theme-option" }, input$2({ type: "radio", name: "theme", value: "grassland", style: "display:none;" }), div$2({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$2({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$2({ style: "width: 58px; height: 58px; background: #74bc21; border-radius: 35px;" })), div$2({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Grassland"))), label$1({ title: "Dessert", class: "theme-option" }, input$2({ type: "radio", name: "theme", value: "dessert", style: "display:none;" }), div$2({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$2({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$2({ style: "width: 58px; height: 58px; background: #fffc5b; border-radius: 35px;" })), div$2({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Dessert"))), label$1({ title: "Kahootiest", class: "theme-option" }, input$2({ type: "radio", name: "theme", value: "kahootiest", style: "display:none;" }), div$2({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$2({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$2({ style: "width: 58px; height: 58px; background: #864cbf; border-radius: 35px;" })), div$2({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Kahoot"))), label$1({ title: "Beam to the Bit [!]", class: "theme-option" }, input$2({ type: "radio", name: "theme", value: "beambit", style: "display:none;" }), div$2({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$2({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$2({ style: "width: 58px; height: 58px; background: #fa0103; border-radius: 35px;" })), div$2({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Beambit [!]"))), label$1({ title: "Pretty Egg", class: "theme-option" }, input$2({ type: "radio", name: "theme", value: "egg", style: "display:none;" }), div$2({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$2({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$2({ style: "width: 58px; height: 58px; background: #ffb1f4; border-radius: 35px;" })), div$2({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Pretty Egg"))), label$1({ title: "Poniryoshka", class: "theme-option" }, input$2({ type: "radio", name: "theme", value: "Poniryoshka", style: "display:none;" }), div$2({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$2({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$2({ style: "width: 58px; height: 58px; background: #dabbe6; border-radius: 35px;" })), div$2({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Poni"))), label$1({ title: "Gameboy [!]", class: "theme-option" }, input$2({ type: "radio", name: "theme", value: "gameboy", style: "display:none;" }), div$2({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$2({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$2({ style: "width: 58px; height: 58px; background: #306230; border-radius: 35px;" })), div$2({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Gameboy [!]"))), label$1({ title: "Woodkid", class: "theme-option" }, input$2({ type: "radio", name: "theme", value: "woodkid", style: "display:none;" }), div$2({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$2({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$2({ style: "width: 58px; height: 58px; background: #41323b; border-radius: 35px;" })), div$2({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Woodkid"))), label$1({ title: "Midnight", class: "theme-option" }, input$2({ type: "radio", name: "theme", value: "midnight", style: "display:none;" }), div$2({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$2({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$2({ style: "width: 58px; height: 58px; background: #445566; border-radius: 35px;" })), div$2({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Midnight"))), label$1({ title: "Snedbox", class: "theme-option" }, input$2({ type: "radio", name: "theme", value: "snedbox", style: "display:none;" }), div$2({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$2({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$2({ style: "width: 58px; height: 58px; background: #10997e; border-radius: 35px;" })), div$2({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Snedbox"))), label$1({ title: "unnamed", class: "theme-option" }, input$2({ type: "radio", name: "theme", value: "unnamed", style: "display:none;" }), div$2({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$2({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$2({ style: "width: 58px; height: 58px; background: #ffffa0; border-radius: 35px;" })), div$2({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "unnamed"))), label$1({ title: "Piano", class: "theme-option" }, input$2({ type: "radio", name: "theme", value: "piano", style: "display:none;" }), div$2({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$2({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$2({ style: "width: 58px; height: 58px; background: #bfbfbf; border-radius: 35px;" })), div$2({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Piano [!]"))), label$1({ title: "Halloween", class: "theme-option" }, input$2({ type: "radio", name: "theme", value: "halloween", style: "display:none;" }), div$2({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$2({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$2({ style: "width: 58px; height: 58px; background: #914300; border-radius: 35px;" })), div$2({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Halloween"))), label$1({ title: "FrozenOver❄️", class: "theme-option" }, input$2({ type: "radio", name: "theme", value: "frozen", style: "display:none;" }), div$2({ style: "display: flex; flex-direction: column; gap: 3px; align-items: center;" }, div$2({ style: "background: black; width: 64px; height: 64px; border-radius: 35px; border: solid; border-color:currentColor; display: flex; align-items: center; justify-content: center;" }, div$2({ style: "width: 58px; height: 58px; background: #99c8ef; border-radius: 35px;" })), div$2({ style: "text-wrap:wrap; max-width: 64px; color:currentColor;" }, "Frozen"))));
            this.themeContainer = div$2({ class: "prompt", style: "width: 330px; max-height: 600px;" }, div$2({ style: "font-size: 2em" }, div$2("Song Themes")), this._form, div$2({ style: "display:flex; flex-direction:row; width:100%; gap: 16px;" }, this._previewButton, this._closeButton));
            this.container = div$2({}, this.themeContainer, this.previewExit);
            this._close = () => {
                if (this.hasChanged == false) {
                    if (this._doc.song.setSongTheme == "none") {
                        if (window.localStorage.getItem("modboxTheme")) {
                            ColorConfig.setTheme(String(window.localStorage.getItem("modboxTheme")));
                        }
                        else {
                            ColorConfig.setTheme("default");
                        }
                    }
                    else {
                        ColorConfig.setTheme(this._doc.song.setSongTheme);
                    }
                    this._doc.prompt = null;
                    this._doc.undo();
                }
                else {
                    this._doc.prompt = null;
                    this._doc.record(new ChangeSongTheme(this._doc, this._doc.song.setSongTheme, this._form.elements["theme"].value), true);
                }
            };
            this._themeChange = () => {
                if (this._form.elements["theme"].value != "none") {
                    ColorConfig.setTheme(this._form.elements["theme"].value);
                }
                else {
                    if (window.localStorage.getItem("modboxTheme")) {
                        ColorConfig.setTheme(String(window.localStorage.getItem("modboxTheme")));
                    }
                    else {
                        ColorConfig.setTheme("default");
                    }
                }
                if (this._form.elements["theme"].value != this._doc.song.setSongTheme) {
                    this.hasChanged = true;
                    this._closeButton.innerHTML = "Save";
                }
                else {
                    this.hasChanged = false;
                    this._closeButton.innerHTML = "Cancel";
                }
            };
            this._previewTheme = () => {
                this.themeContainer.style.opacity = "0";
                this.previewExit.style.pointerEvents = "";
                this._previewText.style.opacity = "1";
            };
            this._exitPreview = () => {
                this.themeContainer.style.opacity = "1";
                this.previewExit.style.pointerEvents = "none";
                this._previewText.style.opacity = "0";
            };
            this.cleanUp = () => {
                this._closeButton.removeEventListener("click", this._close);
            };
            this._closeButton.addEventListener("click", this._close);
            this._previewButton.addEventListener("click", this._previewTheme);
            this.previewExit.addEventListener("click", this._exitPreview);
            this._form.addEventListener("change", this._themeChange);
            if (this._doc.song.setSongTheme != "none") {
                this._form.elements["theme"].value = this._doc.song.setSongTheme;
            }
            else {
                this._form.elements["theme"].value = "none";
            }
        }
    }

    class Layout {
        static setLayout(layout) {
            this._styleElement.textContent = this._layoutMap[layout];
        }
    }
    Layout._layoutMap = {
        "small": "",
        "full": `\
		body {
			margin: 0;
		}

		.centerDiv {
			width: unset !important;
		}

		#beepboxEditorContainer {
			width: 100% !important;
			height: 100vh !important;
		}
		
		.modTitle {
		display: none;
		}

		.beepboxEditor {
			width: 100%;
			height: 100vh;
			grid-template-columns: var(--full-layout-columns);
			grid-template-rows: minmax(0px, min-content) minmax(0px, 1fr) minmax(0, min-content);
			overflow-y: hidden;
		}

		.editorBox {
			height: unset !important;
		}

		.trackContainer {
			width: unset !important;
			overflow-x: scroll !important;
		}

		.beepboxEditor .trackAndMuteContainer {
			width: 100%;
			min-height: 0;
			flex: 1;
			overflow: auto;
		}

		.trackArea {
			overflow-y: scroll;
		}

		.barScrollBar {
			display: none !important;
		}
		`,
        "middle": `\
				body {
			margin: 0;
		}

		.centerDiv {
			width: unset !important;
		}

		.modTitle {
		display: none;
		}

		#beepboxEditorContainer {
			width: 100% !important;
			height: 100vh !important;
		}
		
		.beepboxEditor {
			width: 100%;
			height: 100vh;
			grid-template-areas:
				"settings-area      pattern-area  advanced-settings-area" 
				"song-settings-area pattern-area  advanced-settings-area" 
				"song-settings-area track-area    advanced-settings-area" !important;
			grid-template-columns: var(--middle-layout-columns);
			grid-template-rows: minmax(0px, min-content) minmax(0px, 1fr) minmax(0, min-content);
			overflow-y: hidden;
		}

		.settings-area {
			margin-left: 0 !important;
			margin-right: 6px !important;
		}

		.song-settings-area {
			margin-left: 0 !important;
			margin-right: 6px !important;
		}

		.editorBox {
			height: unset !important;
		}

		.trackContainer {
			width: unset !important;
			overflow-x: scroll !important;
		}

		.trackArea {
			overflow-y: scroll;
		}

		.beepboxEditor .trackAndMuteContainer {
			width: 100%;
			min-height: 0;
			flex: 1;
			overflow: auto;
		}

		.barScrollBar {
			display: none !important;
		}
		`,
        "flow": `\
		body {
			margin: 0;
		}

		.beepboxEditor {
			width: 100%;
			height: 100vh;
			grid-template-areas:
				"settings-area settings-area         " 
				"song-settings-area     pattern-area" 
				"advanced-settings-area pattern-area"
				"advanced-settings-area track-area  " !important;
			grid-template-columns: 190px minmax(0, 1fr);
			grid-template-rows: minmax(0px, min-content) minmax(0px, min-content) minmax(0px, 1fr);
			overflow-y: hidden;
		}


		.centerDiv {
			width: unset !important;
		}

		#beepboxEditorContainer {
			width: 100% !important;
			height: 100vh !important;
		}
		
		.modTitle {
		display: none;
		}

		.editorBox {
			height: unset !important;
		}

		.trackContainer {
			width: unset !important;
			overflow-x: scroll !important;
		}

		.beepboxEditor .trackAndMuteContainer {
			width: 100%;
			min-height: 0;
			flex: 1;
			overflow: auto;
		}

		.trackArea {
			overflow-y: scroll;
		}

		.barScrollBar {
			display: none !important;
		}

		.beepboxEditor .editor-settings {
			margin-right: 6px;
		}

		.settings-area {
			width: 50% !important;
  			gap: 3px !important;
			flex-direction: row !important;
		}

		.settings-area .title {
			flex: 1;
		}

		.settings-area .controller {
			flex-direction: row-reverse !important;
			flex: 3;
		}

		.settings-area .controller div {
			flex: 1;
		}

		.settings-area .editor-widgets {
			flex: 1;
		}

		.settings-area .editor-widgets .editor-menus {
			flex-direction: row;
			gap: 3px;
			margin-top: .2em;
			width: 0 !important;
		}

		.settings-area .editor-widgets .editor-menus .selectContainer {
			display: flex;
  			justify-content: center;
		}

		.settings-area .editor-widgets .editor-menus svg {
			left: unset !important;
		}

		.settings-area .editor-widgets .editor-menus .selectContainer select {
			width: 0 !important;
		}

		.beepboxEditor .selectContainer.menu::after {
			content: none !important;
		}
		`,
    };
    Layout._styleElement = document.head.appendChild(HTML.style({ type: "text/css" }));

    const { button: button$1, label, div: div$1, form, input: input$1 } = HTML;
    class LayoutPrompt {
        constructor(_doc) {
            this._doc = _doc;
            this._fileInput = input$1({ type: "file", accept: ".json,application/json,.mid,.midi,audio/midi,audio/x-midi" });
            this._okayButton = button$1({ class: "okayButton", style: "flex:1;" }, "Okay");
            this._cancelButton = button$1({ style: "flex: 1; width: 0;" }, "Cancel");
            this._form = form({ style: "display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; max-height: 265px; overflow-y: scroll; overflow-x: hidden;" }, label({ class: "layout-option" }, input$1({ type: "radio", name: "layout", value: "small" }), SVG(`\
					<svg viewBox="-4 -1 28 22">
						<rect x="0" y="0" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1"/>
						<rect x="2" y="2" width="11" height="10" fill="currentColor"/>
						<rect x="14" y="2" width="4" height="16" fill="currentColor"/>
						<rect x="2" y="13" width="11" height="5" fill="currentColor"/>
					</svg>
				`), div$1("Small")), label({ class: "layout-option" }, input$1({ type: "radio", name: "layout", value: "full" }), SVG(`\
					<svg viewBox="-1 -1 28 22">
						<rect x="0" y="0" width="26" height="20" fill="none" stroke="currentColor" stroke-width="1"/>
						<rect x="2" y="2" width="12" height="10" fill="currentColor"/>
						<rect x="15" y="2" width="4" height="16" fill="currentColor"/>
						<rect x="20" y="2" width="4" height="16" fill="currentColor"/>
						<rect x="2" y="13" width="12" height="5" fill="currentColor"/>
					</svg>
				`), div$1("Full")), label({ class: "layout-option" }, input$1({ type: "radio", name: "layout", value: "middle" }), SVG(`\
					<svg viewBox="-1 -1 28 22">
						<rect x="0" y="0" width="26" height="20" fill="none" stroke="currentColor" stroke-width="1"/>
						<rect x="7" y="2" width="12" height="10" fill="currentColor"/>
						<rect x="2" y="2" width="4" height="16" fill="currentColor"/>
						<rect x="20" y="2" width="4" height="16" fill="currentColor"/>
						<rect x="7" y="13" width="12" height="5" fill="currentColor"/>
					</svg>
				`), div$1("Middle")), label({ class: "layout-option" }, input$1({ type: "radio", name: "layout", value: "flow" }), SVG(`\
					<svg viewBox="-1 -1 28 22">
						<rect x="0" y="0" width="26" height="20" fill="none" stroke="currentColor" stroke-width="1"/>
						<rect x="7" y="5" width="17" height="7" fill="currentColor"/>
						<rect x="2" y="2" width="22" height="2" fill="currentColor"/>
						<rect x="2" y="5" width="4" height="13" fill="currentColor"/>
						<rect x="7" y="13" width="17" height="5" fill="currentColor"/>
					</svg>
				`), div$1("Flow")));
            this.container = div$1({ class: "prompt noSelection", style: "width: 300px;" }, div$1({ style: "font-size: 2em" }, div$1("Layouts")), this._form, div$1({ style: "display: flex; flex-direction: row; justify-content: space-between; gap: 3px;" }, this._cancelButton, this._okayButton));
            this._close = () => {
                this._doc.undo();
            };
            this.cleanUp = () => {
                this._okayButton.removeEventListener("click", this._confirm);
                this._cancelButton.removeEventListener("click", this._close);
                this.container.removeEventListener("keydown", this._whenKeyPressed);
            };
            this._whenKeyPressed = (event) => {
                if (event.target.tagName != "BUTTON" && event.keyCode == 13) {
                    this._confirm();
                }
            };
            this._confirm = () => {
                window.localStorage.setItem("layout", this._form.elements["layout"].value);
                this._doc.prefs.layout = this._form.elements["layout"].value;
                Layout.setLayout(this._doc.prefs.layout);
                this._close();
            };
            this._fileInput.select();
            setTimeout(() => this._fileInput.focus());
            this._okayButton.addEventListener("click", this._confirm);
            this._cancelButton.addEventListener("click", this._close);
            this.container.addEventListener("keydown", this._whenKeyPressed);
            this._form.elements["layout"].value = this._doc.prefs.layout;
        }
    }

    const { button, div, span, select, option, input, a } = HTML;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|android|ipad|playbook|silk/i.test(navigator.userAgent);
    let songThemeSet = "none";
    function buildOptions(menu, items) {
        for (let index = 0; index < items.length; index++) {
            menu.appendChild(option({ value: index }, items[index]));
        }
        return menu;
    }
    function buildOptionsWithSpecificValues(menu, items, values) {
        if (items.length != values.length) {
            throw new Error("items and values don't have the same length");
        }
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const value = values[i];
            menu.appendChild(option({ value: value }, item));
        }
        return menu;
    }
    function setSelectedIndex(menu, index) {
        if (menu.selectedIndex != index)
            menu.selectedIndex = index;
    }
    function setSelectedValue(menu, index) {
        if (menu.value != index)
            menu.value = index;
    }
    class Slider {
        constructor(input, _doc, _getChange) {
            this.input = input;
            this._doc = _doc;
            this._getChange = _getChange;
            this._change = null;
            this._value = 0;
            this._oldValue = 0;
            this._whenInput = () => {
                const continuingProspectiveChange = this._doc.lastChangeWas(this._change);
                if (!continuingProspectiveChange)
                    this._oldValue = this._value;
                this._change = this._getChange(this._oldValue, parseInt(this.input.value));
                this._doc.setProspectiveChange(this._change);
            };
            this._whenChange = () => {
                this._doc.record(this._change);
                this._change = null;
            };
            input.addEventListener("input", this._whenInput);
            input.addEventListener("change", this._whenChange);
        }
        updateValue(value) {
            this._value = value;
            this.input.value = String(value);
        }
    }
    class SongEditor {
        constructor(_doc) {
            this._doc = _doc;
            this.prompt = null;
            this._patternEditor = new PatternEditor(this._doc);
            this._trackEditor = new TrackEditor(this._doc);
            this._loopEditor = new LoopEditor(this._doc);
            this._trackContainer = div({ class: "trackContainer" }, this._trackEditor.container, this._loopEditor.container);
            this._trackVisibleArea = div({ style: "position: absolute; width: 100%; height: 100%; pointer-events: none;" });
            this._barScrollBar = new BarScrollBar(this._doc, this._trackContainer);
            this._octaveScrollBar = new OctaveScrollBar(this._doc);
            this._piano = new Piano(this._doc);
            this._editorBox = div({ class: "editorBox", style: "height: 481px; display: flex; flex-direction: row; margin-bottom: 6px;" }, this._piano.container, this._patternEditor.container, this._octaveScrollBar.container);
            this._trackAndMuteContainer = div({ class: "trackAndMuteContainer prefers-big-scrollbars" }, this._trackContainer, this._trackVisibleArea);
            this._trackEditorBox = div({ class: "track-area" }, this._trackAndMuteContainer, this._barScrollBar.container);
            this._playButton = button({ style: "width:0; flex:2;", type: "button" });
            this._prevBarButton = button({ class: "prevBarButton", style: "width: 0; margin: 0px; flex:1; margin-left: 0px;", type: "button", title: "Prev Bar (left bracket)" });
            this._nextBarButton = button({ class: "nextBarButton", style: "width: 0; margin: 0px; flex:1; margin-left: 0px;", type: "button", title: "Next Bar (right bracket)" });
            this._volumeSlider = input({ title: "main volume", style: "flex:1; margin: 0px;", type: "range", min: "0", max: "100", value: "50", step: "1" });
            this._fileMenu = select({ style: "width: 100%;" }, option({ selected: true, disabled: true, hidden: false }, "File Menu"), option({ value: "cleanS" }, "New Song"), option({ value: "import" }, "Import JSON..."), option({ value: "export" }, "Export Song..."), option({ value: "shortenUrl" }, "Shorten Song Url..."), option({ value: "songdata" }, "Song Data..."), option({ value: "manual" }, "Open Manual..."));
            this._editMenu = select({ style: "width: 100%;" }, option({ selected: true, disabled: true, hidden: false }, "Edit Menu"), option({ value: "undo" }, "Undo (Z)"), option({ value: "redo" }, "Redo (Y)"), option({ value: "copy" }, "Copy Pattern (C)"), option({ value: "cut" }, "Cut Pattern (X)"), option({ value: "paste" }, "Paste Pattern (V)"), option({ value: "transposeUp" }, "Shift Notes Up (+)"), option({ value: "transposeDown" }, "Shift Notes Down (-)"), option({ value: "duration" }, "Custom Song Size (Q)"), option({ value: "songTheme" }, "Set Song Theme..."));
            this._optionsMenu = select({ style: "width: 100%;" }, option({ selected: true, disabled: true, hidden: false }, "Preferences Menu"), option({ value: "autoPlay" }, "Auto Play On Load"), option({ value: "autoFollow" }, "Auto Follow Track"), option({ value: "showLetters" }, "Show Piano"), option({ value: "showFifth" }, "Highlight 'Fifth' Notes"), option({ value: "showMore" }, "Advanced Color Scheme"), option({ value: "showChannels" }, "Show All Channels"), option({ value: "showScrollBar" }, "Octave Scroll Bar"), option({ value: "showVolumeBar" }, "Show Channel Volume"), option({ value: "advancedSettings" }, "Enable Advanced Settings"), option({ value: "themes" }, "Set Theme..."), option({ value: "layouts" }, "Set Layout..."));
            this._newSongButton = button({ type: "button" }, div({}, "New"), span({ class: "fullWidthOnly" }, div({}, " Song")), SVG.svg({ style: "flex-shrink: 0; position: absolute; left: 0; top: 50%; margin-top: -1em; pointer-events: none;", width: "2em", height: "2em", viewBox: "-5 -21 26 26" }, SVG.path({ d: "M 2 0 L 2 -16 L 10 -16 L 14 -12 L 14 0 z M 3 -1 L 13 -1 L 13 -11 L 9 -11 L 9 -15 L 3 -15 z", fill: "currentColor" })));
            this._songDataButton = button({ type: "button" }, div({}, "Song Data"), SVG.svg({ style: "flex-shrink: 0; position: absolute; left: 0; top: 50%; margin-top: -1em; pointer-events: none;", width: "2em", height: "2em", viewBox: "-5 -21 26 26" }, SVG.path({ d: "M 0 0 L 16 0 L 16 -13 L 10 -13 L 8 -16 L 0 -16 L 0 -13 z", fill: "currentColor" })));
            this._customizeButton = button({ type: "button" }, span({ class: "center" }, div({}, "Custom Song Size")), SVG.svg({ style: "flex-shrink: 0; position: absolute; left: 0; top: 50%; margin-top: -1em; pointer-events: none;", width: "2em", height: "2em", viewBox: "-13 -13 26 26" }, SVG.path({ d: "M -8 2 L -2 2 L -2 8 L 2 8 L 2 2 L 8 2 L 8 -2 L 2 -2 L 2 -8 L -2 -8 L -2 -2 L -8 -2 z M 0 2 L -4 -2 L -1 -2 L -1 -8 L 1 -8 L 1 -2 L 4 -2 z M -8 -8 L 8 -8 L 8 -9 L -8 -9 L -8 -8 z", fill: "currentColor" })));
            this._archiveButton = button({ type: "button" }, span({ class: "center" }, div({}, "Load Mods...")), SVG.svg({ style: "flex-shrink: 0; position: absolute; left: 0; top: 50%; margin-top: -1em; pointer-events: none;", width: "2em", height: "2em", viewBox: "-13 -13 26 26" }, SVG.path({ d: "M 5.78 -1.6 L 7.93 -0.94 L 7.93 0.94 L 5.78 1.6 L 4.85 3.53 L 5.68 5.61 L 4.21 6.78 L 2.36 5.52 L 0.27 5.99 L -0.85 7.94 L -2.68 7.52 L -2.84 5.28 L -4.52 3.95 L -6.73 4.28 L -7.55 2.59 L -5.9 1.07 L -5.9 -1.07 L -7.55 -2.59 L -6.73 -4.28 L -4.52 -3.95 L -2.84 -5.28 L -2.68 -7.52 L -0.85 -7.94 L 0.27 -5.99 L 2.36 -5.52 L 4.21 -6.78 L 5.68 -5.61 L 4.85 -3.53 M 2.92 0.67 L 2.92 -0.67 L 2.35 -1.87 L 1.3 -2.7 L 0 -3 L -1.3 -2.7 L -2.35 -1.87 L -2.92 -0.67 L -2.92 0.67 L -2.35 1.87 L -1.3 2.7 L -0 3 L 1.3 2.7 L 2.35 1.87 z", fill: "currentColor" })));
            this._undoButton = button({ type: "button", style: "width: 45%; margin: 0px; margin-top: -2px;" }, div({}, "Undo"));
            this._redoButton = button({ type: "button", style: "width: 45%; margin: 0px; margin-top: -2px;" }, div({}, "Redo"));
            this._exportButton = button({ type: "button" }, div({}, "Export"), SVG.svg({ style: "flex-shrink: 0; position: absolute; left: 0; top: 50%; margin-top: -1em; pointer-events: none;", width: "2em", height: "2em", viewBox: "-13 -13 26 26" }, SVG.path({ d: "M -8 3 L -8 8 L 8 8 L 8 3 L 6 3 L 6 6 L -6 6 L -6 3 z M 0 2 L -4 -2 L -1 -2 L -1 -8 L 1 -8 L 1 -2 L 4 -2 z", fill: "currentColor" })));
            this._scaleSelect = buildOptions(select({}), Config.scales.map(scale => scale.name));
            this._mixSelect = buildOptions(select({}), Config.mixNames);
            this._sampleRateSelect = buildOptions(select({}), Config.sampleRateNames);
            this._mixHint = a({ class: "hintButton" }, div({}, "?"));
            this._archiveHint = a({ class: "hintButton" }, div({}, "?"));
            this._mixSelectRow = div({ class: "selectRow" }, this._mixHint, this._mixSelect);
            this._instrumentTypeHint = a({ class: "hintButton" }, div({}, "?"));
            this._keySelect = buildOptions(select({}), Config.keys.map(key => key.name).reverse());
            this._tempoSlider = new Slider(input({ style: "margin: 0px;", type: "range", min: "0", max: Config.tempoSteps - 1, value: "7", step: "1" }), this._doc, (oldValue, newValue) => new ChangeTempo(this._doc, oldValue, newValue));
            this._reverbSlider = new Slider(input({ style: "margin: 0px;", type: "range", min: "0", max: Config.reverbRange - 1, value: "0", step: "1" }), this._doc, (oldValue, newValue) => new ChangeReverb(this._doc, oldValue, newValue));
            this._blendSlider = new Slider(input({ style: "width: 9em; margin: 0px;", type: "range", min: "0", max: Config.blendRange - 1, value: "0", step: "1" }), this._doc, (oldValue, newValue) => new ChangeBlend(this._doc, oldValue, newValue));
            this._riffSlider = new Slider(input({ style: "width: 9em; margin: 0px;", type: "range", min: "0", max: Config.riffRange - 1, value: "0", step: "1" }), this._doc, (oldValue, newValue) => new ChangeRiff(this._doc, oldValue, newValue));
            this._detuneSlider = new Slider(input({ style: "width: 9em; margin: 0px;", type: "range", min: "0", max: Config.detuneRange - 1, value: "0", step: "1" }), this._doc, (oldValue, newValue) => new ChangeDetune(this._doc, oldValue, newValue));
            this._muffSlider = new Slider(input({ style: "width: 9em; margin: 0px;", type: "range", min: "0", max: Config.muffRange - 1, value: "0", step: "1" }), this._doc, (oldValue, newValue) => new ChangeMuff(this._doc, oldValue, newValue));
            this._imuteButton = button({ style: "width: 27px;", type: "button" });
            this._iMmuteButton = button({ style: "width: 27px;", type: "button" });
            this._partSelect = buildOptions(select({}), Config.partNames);
            this._instrumentTypeSelect = buildOptionsWithSpecificValues(select({}), Config.pitchChannelTypeNames, Config.pitchChannelTypeValues);
            this._instrumentTypeSelectRow = div({ class: "selectRow" }, span({}, div({}, "Type: ")), this._instrumentTypeHint, div({ class: "selectContainer" }, this._instrumentTypeSelect));
            this._algorithmSelect = buildOptions(select({}), Config.operatorAlgorithmNames);
            this._algorithmSelectRow = div({ class: "selectRow" }, span({}, div({}, "Algorithm: ")), div({ class: "selectContainer" }, this._algorithmSelect));
            this._instrumentSelect = select({});
            this._instrumentInput = input({ class: "numberInput", type: "number", min: 1 });
            this._instrumentSelectRow = div({ class: "selectRow", style: "display: none;" }, span({}, div({}, "Instrument: ")), div({ class: "inputContainer" }, this._instrumentInput));
            this._instrumentVolumeSlider = new Slider(input({ style: "margin: 8px; width: 60px;", type: "range", min: "-9", max: "0", value: "0", step: "1" }), this._doc, (oldValue, newValue) => new ChangeVolume(this._doc, oldValue, -newValue));
            this._instrumentMVolumeSlider = new Slider(input({ style: "margin: 8px; width: 60px;", type: "range", min: "-5", max: "0", value: "0", step: "1" }), this._doc, (oldValue, newValue) => new ChangeVolume(this._doc, oldValue, -newValue));
            this._instrumentVolumeSliderRow = div({ class: "selectRow" }, span({}, div({}, "Volume: ")), this._instrumentVolumeSlider.input, this._imuteButton);
            this._instrumentMVolumeSliderRow = div({ class: "selectRow" }, span({}, div({}, "Volume: ")), this._instrumentMVolumeSlider.input, this._iMmuteButton);
            this._SettingsLabel = div({ style: "margin: 3px 0; text-align: center; color: rgb(170, 170, 170);" }, div({}, "Settings"));
            this._advancedInstrumentSettingsLabel = div({ style: "margin: 3px 0; text-align: center;" }, div({}, "Advanced Instrument Settings"));
            this._waveSelect = buildOptions(select({}), Config.waveNames);
            this._drumSelect = buildOptions(select({}), Config.drumNames);
            this._pwmwaveSelect = buildOptions(select({}), Config.pwmwaveNames);
            this._waveSelectRow = div({ class: "selectRow" }, span({}, div({}, "Wave: ")), div({ class: "selectContainer" }, this._waveSelect, this._pwmwaveSelect, this._drumSelect));
            this._transitionSelect = buildOptions(select({}), Config.transitionNames);
            this._filterSelect = buildOptions(select({}), Config.filterNames);
            this._filterSelectRow = div({ class: "selectRow" }, span({}, div({}, "Filter: ")), div({ class: "selectContainer" }, this._filterSelect));
            this._chorusSelect = buildOptions(select({}), Config.chorusNames);
            this._chorusHint = a({ class: "hintButton" }, div({}, "?"));
            this._chorusSelectRow = div({ class: "selectRow" }, span({}, div({}, "Chorus: ")), div({ class: "selectContainer" }, this._chorusSelect));
            this._effectSelect = buildOptions(select({}), Config.effectNames);
            this._effectSelectRow = div({ class: "selectRow" }, span({}, div({}, "Effect: ")), div({ class: "selectContainer" }, this._effectSelect));
            this._harmSelect = buildOptions(select({}), Config.harmDisplay);
            this._harmSelectRow = div({ class: "selectRow" }, span({}, div({}, "Chord: ")), this._chorusHint, div({ class: "selectContainer" }, this._harmSelect));
            this._octoffSelect = buildOptions(select({}), Config.octoffNames);
            this._octoffSelectRow = div({ class: "selectRow" }, span({}, div({}, "Octave Offset: ")), div({ class: "selectContainer" }, this._octoffSelect));
            this._fmChorusSelect = buildOptions(select({}), Config.fmChorusDisplay);
            this._fmChorusSelectRow = div({ class: "selectRow" }, span({}, div({}, "FM Chorus: ")), div({ class: "selectContainer" }, this._fmChorusSelect));
            this._ipanSlider = new Slider(input({ style: "margin: 8px; width: 100px;", type: "range", min: "-8", max: "0", value: "0", step: "1" }), this._doc, (oldValue, newValue) => new ChangeIpan(this._doc, oldValue, -newValue));
            this._ipanSliderRow = div({ class: "selectRow" }, span({}, div({}, "Panning: ")), span({}, div({}, "L")), this._ipanSlider.input, span({}, div({}, "R")));
            this._phaseModGroup = div({ style: "display: flex; flex-direction: column; display: none;" });
            this._feedbackTypeSelect = buildOptions(select({}), Config.operatorFeedbackNames);
            this._feedbackRow1 = div({ class: "selectRow" }, span({}, div({}, "Feedback:")), div({ class: "selectContainer" }, this._feedbackTypeSelect));
            this._feedbackAmplitudeSlider = new Slider(input({ style: "margin: 0px; width: 4em;", type: "range", min: "0", max: Config.operatorAmplitudeMax, value: "0", step: "1", title: "Feedback Amplitude" }), this._doc, (oldValue, newValue) => new ChangeFeedbackAmplitude(this._doc, oldValue, newValue));
            this._feedbackEnvelopeSelect = buildOptions(select({ style: "width: 100%;", title: "Feedback Envelope" }), Config.operatorEnvelopeNames);
            this._feedbackRow2 = div({ class: "operatorRow" }, div({ style: "margin-right: .1em; visibility: hidden;" }, div({}, 1 + ".")), div({ style: "width: 3em; margin-right: .3em;" }), this._feedbackAmplitudeSlider.input, div({ class: "selectContainer", style: "width: 5em; margin-left: .3em;" }, this._feedbackEnvelopeSelect));
            this._songSettingsButton = button({ style: "flex: 1; border-bottom: solid 2px var(--link-accent);" }, "Song");
            this._instSettingsButton = button({ style: "flex: 1;" }, "Instrument");
            this._settingsTabs = div({ style: "display: flex; gap: 3px;" }, this._songSettingsButton, this._instSettingsButton);
            this._instrumentSettingsGroup = div({ style: "display:none;" }, this._instrumentSelectRow, this._instrumentTypeSelectRow, this._instrumentMVolumeSliderRow, this._instrumentVolumeSliderRow, this._waveSelectRow, div({ class: "selectRow" }, span({}, div({}, "Transitions: ")), div({ class: "selectContainer" }, this._transitionSelect)), this._filterSelectRow, this._chorusSelectRow, this._effectSelectRow, this._algorithmSelectRow, this._phaseModGroup, this._feedbackRow1, this._feedbackRow2);
            this._songSettingsGroup = div({ class: "editor-song-settings" }, div({ class: "selectRow" }, span({}, div({}, "Scale: ")), div({ class: "selectContainer", style: "margin: 3px 0; text-align: center; color: #ccc;" }, this._scaleSelect)), div({ class: "selectRow" }, span({}, div({}, "Key: ")), div({ class: "selectContainer", style: "margin: 3px 0; text-align: center; color: #ccc;" }, this._keySelect)), div({ class: "selectRow" }, span({}, div({}, "Tempo: ")), this._tempoSlider.input), div({ class: "selectRow" }, span({}, div({}, "Reverb: ")), this._reverbSlider.input), div({ class: "selectRow" }, span({}, div({}, "Rhythm: ")), div({ class: "selectContainer", style: "margin: 3px 0; text-align: center; color: #ccc;" }, this._partSelect)));
            this._advancedInstrumentSettingsGroup = div({}, this._advancedInstrumentSettingsLabel, this._ipanSliderRow, this._harmSelectRow, this._octoffSelectRow, this._fmChorusSelectRow);
            this._promptContainer = div({ class: "promptContainer", id: "promptContainer", style: "display: none;" });
            this._advancedSongSettings = div({ class: "editor-song-settings", style: "margin: 0px 5px;" }, div({ style: "margin: 3px 0; text-align: center;" }, div({}, "Advanced Song Settings")), div({ class: "selectRow" }, span({}, div({}, "Mix: ")), div({ class: "selectContainer" }, this._mixSelectRow)), div({ class: "selectRow" }, span({}, div({}, "Sample Rate: ")), div({ class: "selectContainer" }, this._sampleRateSelect)), div({ class: "selectRow" }, span({}, div({}, "Blending: ")), this._blendSlider.input), div({ class: "selectRow" }, span({}, div({}, "Riff: ")), this._riffSlider.input), div({ class: "selectRow" }, span({}, div({}, "Detune: ")), this._detuneSlider.input), div({ class: "selectRow" }, span({}, div({}, "Muff: ")), this._muffSlider.input));
            this._advancedSettingsContainer = div({ class: "advanced-settings-area", style: "margin: 0px 5px;" }, div({ class: "editor-widgets" }, div({ style: "text-align: center;" }, div({}, "Advanced Settings")), div({ style: "margin: 2px 0; display: flex; flex-direction: row; align-items: center;" }), div({ class: "editor-menus" }, div({ style: "margin: 5px 0; display: flex; flex-direction: row; justify-content: space-between;" }, this._prevBarButton, this._undoButton, this._redoButton, this._nextBarButton)), div({ class: "editor-settings" }, this._advancedSongSettings, div({ class: "editor-instrument-settings" }, this._advancedInstrumentSettingsGroup))));
            this.mainLayer = div({ class: "beepboxEditor", tabIndex: "0" }, this._editorBox, this._trackEditorBox, div({ class: "settings-area" }, div({ class: "title", style: "align-items: center; display: flex; justify-content: center;" }, div({}, "Neo NepBox")), div({ class: "controller", style: "margin: 5px 0; gap: 3px; display: flex; flex-direction: column; align-items: center;" }, div({ style: "display:flex; flex-direction:row;" }, SVG.svg({ width: "2em", height: "2em", viewBox: "0 0 26 26" }, SVG.path({ d: "M 4 17 L 4 9 L 8 9 L 12 5 L 12 21 L 8 17 z", fill: ColorConfig.volumeIcon }), SVG.path({ d: "M 15 11 L 16 10 A 7.2 7.2 0 0 1 16 16 L 15 15 A 5.8 5.8 0 0 0 15 12 z", fill: ColorConfig.volumeIcon }), SVG.path({ d: "M 18 8 L 19 7 A 11.5 11.5 0 0 1 19 19 L 18 18 A 10.1 10.1 0 0 0 18 8 z", fill: ColorConfig.volumeIcon })), this._volumeSlider), div({ style: "display: flex; flex-direction: row; align-items: center; width:100%; gap: 3px;" }, this._playButton, this._prevBarButton, this._nextBarButton)), div({ class: "editor-widgets" }, div({ class: "editor-menus" }, div({ class: "selectContainer menu" }, this._fileMenu, SVG.svg({ style: "flex-shrink: 0; position: absolute; left: 0; top: 50%; margin-top: -1em; pointer-events: none;", width: "2em", height: "2em", viewBox: "-5 -21 26 26" }, SVG.path({ d: "M 0 0 L 16 0 L 16 -13 L 10 -13 L 8 -16 L 0 -16 L 0 -13 z", fill: "currentColor" }))), div({ class: "selectContainer menu" }, this._editMenu, SVG.svg({ style: "flex-shrink: 0; position: absolute; left: 0; top: 50%; margin-top: -1em; pointer-events: none;", width: "2em", height: "2em", viewBox: "-5 -21 26 26" }, SVG.path({ d: "M 0 0 L 1 -4 L 4 -1 z M 2 -5 L 10 -13 L 13 -10 L 5 -2 zM 11 -14 L 13 -16 L 14 -16 L 16 -14 L 16 -13 L 14 -11 z", fill: "currentColor" }))), div({ class: "selectContainer menu" }, this._optionsMenu, SVG.svg({ style: "flex-shrink: 0; position: absolute; left: 0; top: 50%; margin-top: -1em; pointer-events: none;", width: "2em", height: "2em", viewBox: "-13 -13 26 26" }, SVG.path({ d: "M 5.78 -1.6 L 7.93 -0.94 L 7.93 0.94 L 5.78 1.6 L 4.85 3.53 L 5.68 5.61 L 4.21 6.78 L 2.36 5.52 L 0.27 5.99 L -0.85 7.94 L -2.68 7.52 L -2.84 5.28 L -4.52 3.95 L -6.73 4.28 L -7.55 2.59 L -5.9 1.07 L -5.9 -1.07 L -7.55 -2.59 L -6.73 -4.28 L -4.52 -3.95 L -2.84 -5.28 L -2.68 -7.52 L -0.85 -7.94 L 0.27 -5.99 L 2.36 -5.52 L 4.21 -6.78 L 5.68 -5.61 L 4.85 -3.53 M 2.92 0.67 L 2.92 -0.67 L 2.35 -1.87 L 1.3 -2.7 L 0 -3 L -1.3 -2.7 L -2.35 -1.87 L -2.92 -0.67 L -2.92 0.67 L -2.35 1.87 L -1.3 2.7 L -0 3 L 1.3 2.7 L 2.35 1.87 z", fill: "currentColor" })))))), div({ class: "song-settings-area editor-settings" }, this._SettingsLabel, this._settingsTabs, this._songSettingsGroup, div({ class: "editor-instrument-settings" }, this._instrumentSettingsGroup)), this._advancedSettingsContainer, this._promptContainer);
            this._changeTranspose = null;
            this._operatorRows = [];
            this._operatorAmplitudeSliders = [];
            this._operatorEnvelopeSelects = [];
            this._operatorFrequencySelects = [];
            this._refocusStage = () => {
                this.mainLayer.focus();
            };
            this.whenUpdated = () => {
                const trackBounds = this._trackContainer.getBoundingClientRect();
                this._doc.trackVisibleBars = Math.floor((trackBounds.right - trackBounds.left) / 32);
                this._barScrollBar.render();
                this._trackEditor.render();
                this._patternEditor.render();
                if (this._doc.song.setSongTheme != songThemeSet) {
                    if (this._doc.song.setSongTheme == "none") {
                        if (window.localStorage.getItem("modboxTheme") != null) {
                            ColorConfig.setTheme(String(window.localStorage.getItem("modboxTheme")));
                        }
                        else {
                            window.localStorage.setItem("modboxTheme", "default");
                            ColorConfig.setTheme("default");
                        }
                    }
                    else {
                        ColorConfig.setTheme(this._doc.song.setSongTheme);
                    }
                    songThemeSet = this._doc.song.setSongTheme;
                }
                document.documentElement.style.setProperty("--full-layout-columns", this._doc.prefs.advancedSettings ? "minmax(0, 1fr) 190px 200px" : "minmax(0, 1fr) 190px");
                document.documentElement.style.setProperty("--middle-layout-columns", this._doc.prefs.advancedSettings ? "190px minmax(0, 1fr) 200px" : "190px minmax(0, 1fr)");
                const optionCommands = [
                    (this._doc.prefs.autoPlay ? "✓ " : "✗ ") + "Auto Play On Load",
                    (this._doc.prefs.autoFollow ? "✓ " : "✗ ") + "Auto Follow Track",
                    (this._doc.prefs.showLetters ? "✓ " : "✗ ") + "Show Piano",
                    (this._doc.prefs.showFifth ? "✓ " : "✗ ") + "Highlight 'Fifth' Notes",
                    (this._doc.prefs.showMore ? "✓ " : "✗ ") + "Advanced Color Scheme",
                    (this._doc.prefs.showChannels ? "✓ " : "✗ ") + "Show All Channels",
                    (this._doc.prefs.showScrollBar ? "✓ " : "✗ ") + "Octave Scroll Bar",
                    (this._doc.prefs.showVolumeBar ? "✓ " : "✗ ") + "Show Channel Volume",
                    (this._doc.prefs.advancedSettings ? "✓ " : "✗ ") + "Enable Advanced Settings",
                    "  Set Theme...",
                ];
                for (let i = 0; i < optionCommands.length; i++) {
                    const option = this._optionsMenu.children[i + 1];
                    if (option.innerText != optionCommands[i])
                        option.innerText = optionCommands[i];
                }
                const channel = this._doc.song.channels[this._doc.channel];
                const pattern = this._doc.getCurrentPattern();
                const instrumentIndex = this._doc.getCurrentInstrument();
                const instrument = channel.instruments[instrumentIndex];
                const wasActive = this.mainLayer.contains(document.activeElement);
                let activeElement = document.activeElement ? document.activeElement : document.activeElement;
                setSelectedIndex(this._scaleSelect, this._doc.song.scale);
                setSelectedIndex(this._mixSelect, this._doc.song.mix);
                setSelectedIndex(this._sampleRateSelect, this._doc.song.sampleRate);
                setSelectedIndex(this._keySelect, Config.keys.length - 1 - this._doc.song.key);
                this._tempoSlider.updateValue(this._doc.song.tempo);
                this._tempoSlider.input.title = this._doc.song.getBeatsPerMinute() + " beats per minute";
                this._reverbSlider.updateValue(this._doc.song.reverb);
                this._advancedSettingsContainer.style.display = this._doc.prefs.advancedSettings ? "" : "none";
                this._blendSlider.updateValue(this._doc.song.blend);
                this._riffSlider.updateValue(this._doc.song.riff);
                this._detuneSlider.updateValue(this._doc.song.detune);
                this._muffSlider.updateValue(this._doc.song.muff);
                setSelectedIndex(this._partSelect, Config.partCounts.indexOf(this._doc.song.partsPerBeat));
                if (this._doc.song.getChannelIsDrum(this._doc.channel)) {
                    if (this._doc.song.mix == 2) {
                        this._instrumentVolumeSliderRow.style.display = "";
                        this._instrumentMVolumeSliderRow.style.display = "none";
                    }
                    else {
                        this._instrumentVolumeSliderRow.style.display = "none";
                        this._instrumentMVolumeSliderRow.style.display = "";
                    }
                    this._drumSelect.style.display = "";
                    this._waveSelectRow.style.display = "";
                    this._instrumentTypeSelectRow.style.display = "none";
                    this._instrumentTypeSelect.style.display = "none";
                    this._algorithmSelectRow.style.display = "none";
                    this._phaseModGroup.style.display = "none";
                    this._feedbackRow1.style.display = "none";
                    this._feedbackRow2.style.display = "none";
                    this._waveSelect.style.display = "none";
                    this._pwmwaveSelect.style.display = "none";
                    this._filterSelectRow.style.display = "none";
                    this._chorusSelectRow.style.display = "none";
                    this._effectSelectRow.style.display = "none";
                    this._ipanSliderRow.style.display = "";
                    this._harmSelectRow.style.display = "";
                    this._octoffSelectRow.style.display = "";
                    this._fmChorusSelectRow.style.display = "none";
                }
                else {
                    this._instrumentTypeSelectRow.style.display = "";
                    this._instrumentTypeSelect.style.display = "";
                    this._effectSelectRow.style.display = "";
                    if (this._doc.song.mix == 2) {
                        this._instrumentVolumeSliderRow.style.display = "";
                        this._instrumentMVolumeSliderRow.style.display = "none";
                    }
                    else {
                        this._instrumentVolumeSliderRow.style.display = "none";
                        this._instrumentMVolumeSliderRow.style.display = "";
                    }
                    this._drumSelect.style.display = "none";
                    if (instrument.type == 0) {
                        this._waveSelect.style.display = "";
                        this._pwmwaveSelect.style.display = "none";
                        this._waveSelectRow.style.display = "";
                        this._filterSelectRow.style.display = "";
                        this._chorusSelectRow.style.display = "";
                        this._harmSelectRow.style.display = "";
                        this._algorithmSelectRow.style.display = "none";
                        this._phaseModGroup.style.display = "none";
                        this._feedbackRow1.style.display = "none";
                        this._feedbackRow2.style.display = "none";
                        this._ipanSliderRow.style.display = "";
                        this._octoffSelectRow.style.display = "";
                        this._fmChorusSelectRow.style.display = "none";
                    }
                    else if (instrument.type == 3) {
                        this._waveSelect.style.display = "none";
                        this._pwmwaveSelect.style.display = "";
                        this._waveSelectRow.style.display = "";
                        this._filterSelectRow.style.display = "none";
                        this._chorusSelectRow.style.display = "none";
                        this._harmSelectRow.style.display = "none";
                        this._algorithmSelectRow.style.display = "none";
                        this._phaseModGroup.style.display = "none";
                        this._feedbackRow1.style.display = "none";
                        this._feedbackRow2.style.display = "none";
                        this._ipanSliderRow.style.display = "";
                        this._octoffSelectRow.style.display = "";
                        this._fmChorusSelectRow.style.display = "none";
                    }
                    else {
                        this._algorithmSelectRow.style.display = "";
                        this._phaseModGroup.style.display = "";
                        this._feedbackRow1.style.display = "";
                        this._feedbackRow2.style.display = "";
                        this._harmSelectRow.style.display = "none";
                        this._waveSelectRow.style.display = "none";
                        this._filterSelectRow.style.display = "none";
                        this._chorusSelectRow.style.display = "none";
                        this._ipanSliderRow.style.display = "";
                        this._octoffSelectRow.style.display = "";
                        this._fmChorusSelectRow.style.display = "";
                    }
                }
                this._instrumentTypeSelect.value = instrument.type + "";
                setSelectedIndex(this._algorithmSelect, instrument.algorithm);
                this._instrumentSelectRow.style.display = (this._doc.song.instrumentsPerChannel > 1) ? "" : "none";
                this._instrumentSelectRow.style.visibility = (pattern == null) ? "hidden" : "";
                console.log(this._doc.song.instrumentsPerChannel);
                if (this._instrumentInput.max != String(this._doc.song.instrumentsPerChannel)) {
                    this._instrumentInput.max = String(this._doc.song.instrumentsPerChannel);
                }
                if (instrument.imute == 0) {
                    this._instrumentSettingsGroup.style.color = this._doc.song.getNoteColorBright(this._doc.channel);
                    this._advancedInstrumentSettingsGroup.style.color = this._doc.song.getNoteColorDim(this._doc.channel);
                    this._advancedSongSettings.style.color = "#aaaaaa";
                    this._imuteButton.innerText = "◉";
                    this._iMmuteButton.innerText = "◉";
                }
                else {
                    this._instrumentSettingsGroup.style.color = "#cccccc";
                    this._advancedInstrumentSettingsGroup.style.color = "#aaaaaa";
                    this._advancedSongSettings.style.color = "#aaaaaa";
                    this._imuteButton.innerText = "◎";
                    this._iMmuteButton.innerText = "◎";
                }
                setSelectedIndex(this._waveSelect, instrument.wave);
                setSelectedIndex(this._drumSelect, instrument.wave);
                setSelectedIndex(this._pwmwaveSelect, instrument.wave);
                setSelectedIndex(this._filterSelect, instrument.filter);
                setSelectedIndex(this._transitionSelect, instrument.transition);
                setSelectedIndex(this._effectSelect, instrument.effect);
                setSelectedIndex(this._chorusSelect, instrument.chorus);
                setSelectedIndex(this._harmSelect, instrument.harm);
                setSelectedIndex(this._octoffSelect, instrument.octoff);
                setSelectedIndex(this._fmChorusSelect, instrument.fmChorus);
                setSelectedIndex(this._feedbackTypeSelect, instrument.feedbackType);
                this._feedbackAmplitudeSlider.updateValue(instrument.feedbackAmplitude);
                setSelectedIndex(this._feedbackEnvelopeSelect, instrument.feedbackEnvelope);
                this._feedbackEnvelopeSelect.parentElement.style.color = (instrument.feedbackAmplitude > 0) ? "" : "#999";
                this._instrumentVolumeSlider.updateValue(-instrument.volume);
                this._instrumentMVolumeSlider.updateValue(-instrument.volume);
                this._ipanSlider.updateValue(-instrument.ipan);
                setSelectedIndex(this._instrumentSelect, instrumentIndex);
                setSelectedValue(this._instrumentInput, String(instrumentIndex + 1));
                for (let i = 0; i < Config.operatorCount; i++) {
                    const isCarrier = (i < Config.operatorCarrierCounts[instrument.algorithm]);
                    this._operatorRows[i].style.color = isCarrier ? "white" : "";
                    setSelectedIndex(this._operatorFrequencySelects[i], instrument.operators[i].frequency);
                    this._operatorAmplitudeSliders[i].updateValue(instrument.operators[i].amplitude);
                    setSelectedIndex(this._operatorEnvelopeSelects[i], instrument.operators[i].envelope);
                    const operatorName = (isCarrier ? "Voice " : "Modulator ") + (i + 1);
                    this._operatorFrequencySelects[i].title = operatorName + " Frequency";
                    this._operatorAmplitudeSliders[i].input.title = operatorName + (isCarrier ? " Volume" : " Amplitude");
                    this._operatorEnvelopeSelects[i].title = operatorName + " Envelope";
                    this._operatorEnvelopeSelects[i].parentElement.style.color = (instrument.operators[i].amplitude > 0) ? "" : "#999";
                }
                this._piano.container.style.display = this._doc.prefs.showLetters ? "" : "none";
                this._octaveScrollBar.container.style.display = this._doc.prefs.showScrollBar ? "" : "none";
                this._barScrollBar.container.style.display = this._doc.song.barCount > this._doc.trackVisibleBars ? "" : "none";
                this._instrumentTypeHint.style.display = (instrument.type == 1) ? "" : "none";
                this._mixHint.style.display = (this._doc.song.mix != 1) ? "" : "none";
                this._chorusHint.style.display = (Config.harmNames[instrument.harm]) ? "" : "none";
                let patternWidth = 512;
                if (this._doc.prefs.showLetters)
                    patternWidth -= 32;
                if (this._doc.prefs.showScrollBar)
                    patternWidth -= 20;
                this._patternEditor.container.style.width = String(patternWidth) + "px";
                this._volumeSlider.value = String(this._doc.prefs.volume);
                if (wasActive && (activeElement.clientWidth == 0)) {
                    this._refocusStage();
                }
                this._setPrompt(this._doc.prompt);
                if (this._doc.prefs.autoFollow && !this._doc.synth.playing) {
                    this._doc.synth.snapToBar(this._doc.bar);
                }
            };
            this._setSongSettings = () => {
                this._songSettingsGroup.style.display = "flex";
                this._instrumentSettingsGroup.style.display = "none";
                this._songSettingsButton.style.borderBottom = "solid 2px var(--link-accent)";
                this._instSettingsButton.style.borderBottom = "";
            };
            this._setInstSettings = () => {
                this._instrumentSettingsGroup.style.display = "unset";
                this._songSettingsGroup.style.display = "none";
                this._instSettingsButton.style.borderBottom = "solid 2px var(--link-accent)";
                this._songSettingsButton.style.borderBottom = "";
            };
            this._muteInstrument = () => {
                const channel = this._doc.song.channels[this._doc.channel];
                const instrumentIndex = this._doc.getCurrentInstrument();
                const instrument = channel.instruments[instrumentIndex];
                const oldValue = instrument.imute;
                const isMuted = oldValue == 1;
                const newValue = isMuted ? 0 : 1;
                this._doc.record(new ChangeImute(this._doc, newValue));
                if (instrument.imute == 0) {
                    this._instrumentSettingsGroup.style.color = this._doc.song.getNoteColorBright(this._doc.channel);
                    this._advancedInstrumentSettingsGroup.style.color = this._doc.song.getNoteColorDim(this._doc.channel);
                    this._advancedSongSettings.style.color = "#aaaaaa";
                    this._imuteButton.innerText = "◉";
                    this._iMmuteButton.innerText = "◉";
                }
                else {
                    this._instrumentSettingsGroup.style.color = "#cccccc";
                    this._advancedInstrumentSettingsGroup.style.color = "#aaaaaa";
                    this._advancedSongSettings.style.color = "#aaaaaa";
                    this._imuteButton.innerText = "◎";
                    this._iMmuteButton.innerText = "◎";
                }
                this.whenUpdated();
            };
            this._captureNumberKeys = (event) => {
                switch (event.keyCode) {
                    case 8:
                    case 13:
                    case 38:
                    case 40:
                    case 37:
                    case 39:
                    case 48:
                    case 49:
                    case 50:
                    case 51:
                    case 52:
                    case 53:
                    case 54:
                    case 55:
                    case 56:
                    case 57:
                        event.stopPropagation();
                        break;
                }
            };
            this._whenKeyPressed = (event) => {
                if (this.prompt) {
                    if (event.keyCode == 27) {
                        window.history.back();
                    }
                    return;
                }
                switch (event.keyCode) {
                    case 8:
                        if (event.ctrlKey) {
                            if (this._doc.channel > 0) {
                                this._doc.record(new ChangeRemoveChannel(this._doc, this._doc.channel, this._doc.channel));
                            }
                        }
                        else {
                            this._doc.record(new ChangeDeleteBars(this._doc, this._doc.bar, 1));
                        }
                        event.preventDefault();
                        break;
                    case 13:
                        if (event.ctrlKey || event.metaKey) {
                            this._doc.selection.insertChannel();
                        }
                        else {
                            this._doc.record(new ChangeInsertBars(this._doc, this._doc.bar + 1, 1));
                        }
                        event.preventDefault();
                        break;
                    case 38:
                        this._trackEditor._setChannelBar((this._doc.channel - 1 + this._doc.song.getChannelCount()) % this._doc.song.getChannelCount(), this._doc.bar);
                        event.preventDefault();
                        break;
                    case 40:
                        this._trackEditor._setChannelBar((this._doc.channel + 1) % this._doc.song.getChannelCount(), this._doc.bar);
                        event.preventDefault();
                        break;
                    case 37:
                        this._trackEditor._setChannelBar(this._doc.channel, (this._doc.bar + this._doc.song.barCount - 1) % this._doc.song.barCount);
                        event.preventDefault();
                        break;
                    case 39:
                        this._trackEditor._setChannelBar(this._doc.channel, (this._doc.bar + 1) % this._doc.song.barCount);
                        event.preventDefault();
                        break;
                    case 48:
                        this._trackEditor._nextDigit("0");
                        event.preventDefault();
                        break;
                    case 49:
                        this._trackEditor._nextDigit("1");
                        event.preventDefault();
                        break;
                    case 50:
                        this._trackEditor._nextDigit("2");
                        event.preventDefault();
                        break;
                    case 51:
                        this._trackEditor._nextDigit("3");
                        event.preventDefault();
                        break;
                    case 52:
                        this._trackEditor._nextDigit("4");
                        event.preventDefault();
                        break;
                    case 53:
                        this._trackEditor._nextDigit("5");
                        event.preventDefault();
                        break;
                    case 54:
                        this._trackEditor._nextDigit("6");
                        event.preventDefault();
                        break;
                    case 55:
                        this._trackEditor._nextDigit("7");
                        event.preventDefault();
                        break;
                    case 56:
                        this._trackEditor._nextDigit("8");
                        event.preventDefault();
                        break;
                    case 57:
                        this._trackEditor._nextDigit("9");
                        event.preventDefault();
                        break;
                    default:
                        this._trackEditor._digits = "";
                        break;
                    case 77:
                        if (event.shiftKey) {
                            this._doc.selection.muteAllInstruments();
                        }
                        else {
                            this._muteInstrument();
                            event.preventDefault();
                        }
                        break;
                    case 83:
                        if (event.ctrlKey || event.metaKey) {
                            this._openPrompt("export");
                            event.preventDefault();
                        }
                        else {
                            this._doc.selection.soloChannels(event.shiftKey);
                            event.preventDefault();
                        }
                        break;
                    case 79:
                        if (event.ctrlKey || event.metaKey) {
                            this._openPrompt("import");
                            event.preventDefault();
                        }
                        break;
                    case 32:
                        this._togglePlay();
                        event.preventDefault();
                        break;
                    case 90:
                        if (event.shiftKey) {
                            this._doc.redo();
                        }
                        else {
                            this._doc.undo();
                        }
                        event.preventDefault();
                        break;
                    case 89:
                        this._doc.redo();
                        event.preventDefault();
                        break;
                    case 88:
                        this._cut();
                        event.preventDefault();
                        break;
                    case 67:
                        this._copy();
                        event.preventDefault();
                        break;
                    case 70:
                        if (event.shiftKey) {
                            this._doc.synth.snapToBar(this._doc.song.loopStart);
                        }
                        else {
                            this._doc.synth.snapToStart();
                        }
                        event.preventDefault();
                        break;
                    case 86:
                        this._paste();
                        event.preventDefault();
                        break;
                    case 219:
                        this._doc.synth.prevBar();
                        if (this._doc.prefs.autoFollow) {
                            new ChangeChannelBar(this._doc, this._doc.channel, Math.floor(this._doc.synth.playhead));
                        }
                        event.preventDefault();
                        break;
                    case 221:
                        this._doc.synth.nextBar();
                        if (this._doc.prefs.autoFollow) {
                            new ChangeChannelBar(this._doc, this._doc.channel, Math.floor(this._doc.synth.playhead));
                        }
                        event.preventDefault();
                        break;
                    case 189:
                    case 173:
                        this._transpose(false);
                        event.preventDefault();
                        break;
                    case 187:
                    case 61:
                        this._transpose(true);
                        event.preventDefault();
                        break;
                    case 81:
                        this._openPrompt("duration");
                        event.preventDefault();
                        break;
                }
            };
            this._whenPrevBarPressed = () => {
                this._doc.synth.prevBar();
            };
            this._whenNextBarPressed = () => {
                this._doc.synth.nextBar();
            };
            this._togglePlay = () => {
                if (this._doc.synth.playing) {
                    this._pause();
                }
                else {
                    this._play();
                }
            };
            this._setVolumeSlider = () => {
                this._doc.setVolume(Number(this._volumeSlider.value));
                this._trackEditor.render();
            };
            this._whenNewSongPressed = () => {
                this._doc.record(new ChangeSong(this._doc, ""));
                this._patternEditor.resetCopiedPins();
            };
            this._whenCustomizePressed = () => {
                this._openPrompt("duration");
            };
            this._advancedUndo = () => {
                this._doc.undo();
            };
            this._advancedRedo = () => {
                this._doc.redo();
            };
            this._openExportPrompt = () => {
                this._openPrompt("export");
            };
            this._openSongDataPrompt = () => {
                this._openPrompt("songdata");
            };
            this._openInstrumentTypePrompt = () => {
                this._openPrompt("instrumentType");
            };
            this._openMixPrompt = () => {
                this._openPrompt("mix");
            };
            this._openChorusPrompt = () => {
                this._openPrompt("chorus");
            };
            this._openArchivePrompt = () => {
                this._openPrompt("archive");
            };
            this.refreshNow = () => {
                setTimeout(() => {
                    location.reload();
                }, 500);
            };
            this._whenSetScale = () => {
                this._doc.record(new ChangeScale(this._doc, this._scaleSelect.selectedIndex));
            };
            this._whenSetMix = () => {
                this._doc.record(new ChangeMix(this._doc, this._mixSelect.selectedIndex));
            };
            this._whenSetSampleRate = () => {
                this._doc.record(new ChangeSampleRate(this._doc, this._sampleRateSelect.selectedIndex));
            };
            this._whenSetKey = () => {
                this._doc.record(new ChangeKey(this._doc, Config.keys.length - 1 - this._keySelect.selectedIndex));
            };
            this._whenSetPartsPerBeat = () => {
                this._doc.record(new ChangePartsPerBeat(this._doc, Config.partCounts[this._partSelect.selectedIndex]));
            };
            this._whenSetInstrumentType = () => {
                this._doc.record(new ChangeInstrumentType(this._doc, +this._instrumentTypeSelect.value));
            };
            this._whenSetFeedbackType = () => {
                this._doc.record(new ChangeFeedbackType(this._doc, this._feedbackTypeSelect.selectedIndex));
            };
            this._whenSetFeedbackEnvelope = () => {
                this._doc.record(new ChangeFeedbackEnvelope(this._doc, this._feedbackEnvelopeSelect.selectedIndex));
            };
            this._whenSetAlgorithm = () => {
                this._doc.record(new ChangeAlgorithm(this._doc, this._algorithmSelect.selectedIndex));
            };
            this._whenSetInstrument = () => {
                const pattern = this._doc.getCurrentPattern();
                if (pattern == null)
                    return;
                this._doc.record(new ChangePatternInstrument(this._doc, Number(this._instrumentInput.value) - 1, pattern));
            };
            this._whenSetWave = () => {
                this._doc.record(new ChangeWave(this._doc, this._waveSelect.selectedIndex));
            };
            this._whenSetDrum = () => {
                this._doc.record(new ChangeWave(this._doc, this._drumSelect.selectedIndex));
            };
            this._whenSetPWMWave = () => {
                this._doc.record(new ChangeWave(this._doc, this._pwmwaveSelect.selectedIndex));
            };
            this._whenSetFilter = () => {
                this._doc.record(new ChangeFilter(this._doc, this._filterSelect.selectedIndex));
            };
            this._whenSetTransition = () => {
                this._doc.record(new ChangeTransition(this._doc, this._transitionSelect.selectedIndex));
            };
            this._whenSetEffect = () => {
                this._doc.record(new ChangeEffect(this._doc, this._effectSelect.selectedIndex));
            };
            this._whenSetHarm = () => {
                this._doc.record(new ChangeHarm(this._doc, this._harmSelect.selectedIndex));
            };
            this._whenSetFMChorus = () => {
                this._doc.record(new ChangeFMChorus(this._doc, this._fmChorusSelect.selectedIndex));
            };
            this._whenSetOctoff = () => {
                this._doc.record(new ChangeOctoff(this._doc, this._octoffSelect.selectedIndex));
            };
            this._whenSetChorus = () => {
                this._doc.record(new ChangeChorus(this._doc, this._chorusSelect.selectedIndex));
            };
            this._fileMenuHandler = (event) => {
                switch (this._fileMenu.value) {
                    case "import":
                        this._openPrompt("import");
                        break;
                    case "export":
                        this._openPrompt("export");
                        break;
                    case "cleanS":
                        this._whenNewSongPressed();
                        break;
                    case "songdata":
                        this._openPrompt("songdata");
                        break;
                    case "manual":
                        window.open("./manual.html");
                        break;
                    case "shortenUrl":
                        window.open("https://tinyurl.com/api-create.php?url=" + encodeURIComponent(new URL("#" + this._doc.song.toBase64String(), location.href).href));
                        break;
                }
                this._fileMenu.selectedIndex = 0;
            };
            this._editMenuHandler = (event) => {
                switch (this._editMenu.value) {
                    case "undo":
                        this._doc.undo();
                        break;
                    case "redo":
                        this._doc.redo();
                        break;
                    case "cut":
                        this._cut();
                        break;
                    case "copy":
                        this._copy();
                        break;
                    case "paste":
                        this._paste();
                        break;
                    case "transposeUp":
                        this._transpose(true);
                        break;
                    case "transposeDown":
                        this._transpose(false);
                        break;
                    case "duration":
                        this._openPrompt("duration");
                        break;
                    case "archive":
                        this._openPrompt("archive");
                        break;
                    case "songTheme":
                        this._openPrompt("songTheme");
                        break;
                }
                this._editMenu.selectedIndex = 0;
            };
            this._optionsMenuHandler = (event) => {
                switch (this._optionsMenu.value) {
                    case "autoPlay":
                        this._doc.prefs.autoPlay = !this._doc.prefs.autoPlay;
                        break;
                    case "autoFollow":
                        this._doc.prefs.autoFollow = !this._doc.prefs.autoFollow;
                        break;
                    case "showLetters":
                        this._doc.prefs.showLetters = !this._doc.prefs.showLetters;
                        break;
                    case "showFifth":
                        this._doc.prefs.showFifth = !this._doc.prefs.showFifth;
                        break;
                    case "showMore":
                        this._doc.prefs.showMore = !this._doc.prefs.showMore;
                        break;
                    case "showChannels":
                        this._doc.prefs.showChannels = !this._doc.prefs.showChannels;
                        break;
                    case "showScrollBar":
                        this._doc.prefs.showScrollBar = !this._doc.prefs.showScrollBar;
                        break;
                    case "showVolumeBar":
                        this._doc.prefs.showVolumeBar = !this._doc.prefs.showVolumeBar;
                        break;
                    case "advancedSettings":
                        this._doc.prefs.advancedSettings = !this._doc.prefs.advancedSettings;
                        break;
                    case "themes":
                        this._openPrompt("themes");
                        break;
                    case "layouts":
                        this._openPrompt("layouts");
                        break;
                }
                this._optionsMenu.selectedIndex = 0;
                this._doc.notifier.changed();
                this._doc.prefs.save();
            };
            this._doc.notifier.watch(this.whenUpdated);
            this._phaseModGroup.appendChild(div({ class: "operatorRow", style: "height: 1em; margin-top: 0.5em;" }, div({ style: "margin-right: .1em; visibility: hidden;" }, div({}, 1 + ".")), div({ style: "width: 3em; margin-right: .3em;" }, div({}, "Freq:")), div({ style: "width: 4em; margin: 0;" }, div({}, "Volume:")), div({ style: "width: 5em; margin-left: .3em;" }, div({}, "Envelope:"))));
            for (let i = 0; i < Config.operatorCount; i++) {
                const operatorIndex = i;
                const operatorNumber = div({ style: "margin-right: .1em; color: #999;" }, div({}, i + 1 + "."));
                const frequencySelect = buildOptions(select({ style: "width: 100%;", title: "Frequency" }), Config.operatorFrequencyNames);
                const amplitudeSlider = new Slider(input({ style: "margin: 0; width: 4em;", type: "range", min: "0", max: Config.operatorAmplitudeMax, value: "0", step: "1", title: "Volume" }), this._doc, (oldValue, newValue) => new ChangeOperatorAmplitude(this._doc, operatorIndex, oldValue, newValue));
                const envelopeSelect = buildOptions(select({ style: "width: 100%;", title: "Envelope" }), Config.operatorEnvelopeNames);
                const row = div({ class: "operatorRow" }, operatorNumber, div({ class: "selectContainer", style: "width: 3em; margin-right: .3em;" }, frequencySelect), amplitudeSlider.input, div({ class: "selectContainer", style: "width: 5em; margin-left: .3em;" }, envelopeSelect));
                this._phaseModGroup.appendChild(row);
                this._operatorRows[i] = row;
                this._operatorAmplitudeSliders[i] = amplitudeSlider;
                this._operatorEnvelopeSelects[i] = envelopeSelect;
                this._operatorFrequencySelects[i] = frequencySelect;
                envelopeSelect.addEventListener("change", () => {
                    this._doc.record(new ChangeOperatorEnvelope(this._doc, operatorIndex, envelopeSelect.selectedIndex));
                });
                frequencySelect.addEventListener("change", () => {
                    this._doc.record(new ChangeOperatorFrequency(this._doc, operatorIndex, frequencySelect.selectedIndex));
                });
            }
            this._fileMenu.addEventListener("change", this._fileMenuHandler);
            this._editMenu.addEventListener("change", this._editMenuHandler);
            this._optionsMenu.addEventListener("change", this._optionsMenuHandler);
            this._scaleSelect.addEventListener("change", this._whenSetScale);
            this._mixSelect.addEventListener("change", this._whenSetMix);
            this._sampleRateSelect.addEventListener("change", this._whenSetSampleRate);
            this._keySelect.addEventListener("change", this._whenSetKey);
            this._partSelect.addEventListener("change", this._whenSetPartsPerBeat);
            this._instrumentTypeSelect.addEventListener("change", this._whenSetInstrumentType);
            this._algorithmSelect.addEventListener("change", this._whenSetAlgorithm);
            this._instrumentInput.addEventListener("change", this._whenSetInstrument);
            this._feedbackTypeSelect.addEventListener("change", this._whenSetFeedbackType);
            this._feedbackEnvelopeSelect.addEventListener("change", this._whenSetFeedbackEnvelope);
            this._waveSelect.addEventListener("change", this._whenSetWave);
            this._drumSelect.addEventListener("change", this._whenSetDrum);
            this._pwmwaveSelect.addEventListener("change", this._whenSetPWMWave);
            this._transitionSelect.addEventListener("change", this._whenSetTransition);
            this._filterSelect.addEventListener("change", this._whenSetFilter);
            this._chorusSelect.addEventListener("change", this._whenSetChorus);
            this._effectSelect.addEventListener("change", this._whenSetEffect);
            this._harmSelect.addEventListener("change", this._whenSetHarm);
            this._octoffSelect.addEventListener("change", this._whenSetOctoff);
            this._fmChorusSelect.addEventListener("change", this._whenSetFMChorus);
            this._imuteButton.addEventListener("click", this._muteInstrument);
            this._iMmuteButton.addEventListener("click", this._muteInstrument);
            this._playButton.addEventListener("click", this._togglePlay);
            this._prevBarButton.addEventListener("click", this._whenPrevBarPressed);
            this._nextBarButton.addEventListener("click", this._whenNextBarPressed);
            this._newSongButton.addEventListener("click", this._whenNewSongPressed);
            this._songDataButton.addEventListener("click", this._openSongDataPrompt);
            this._customizeButton.addEventListener("click", this._whenCustomizePressed);
            this._undoButton.addEventListener("click", this._advancedUndo);
            this._redoButton.addEventListener("click", this._advancedRedo);
            this._exportButton.addEventListener("click", this._openExportPrompt);
            this._archiveButton.addEventListener("click", this._openArchivePrompt);
            this._volumeSlider.addEventListener("input", this._setVolumeSlider);
            this._instrumentTypeHint.addEventListener("click", this._openInstrumentTypePrompt);
            this._mixHint.addEventListener("click", this._openMixPrompt);
            this._chorusHint.addEventListener("click", this._openChorusPrompt);
            this._archiveHint.addEventListener("click", this._openArchivePrompt);
            this._instrumentInput.addEventListener("keydown", this._captureNumberKeys, false);
            this._editorBox.addEventListener("mousedown", this._refocusStage);
            this.mainLayer.addEventListener("keydown", this._whenKeyPressed);
            this._songSettingsButton.addEventListener("click", this._setSongSettings);
            this._instSettingsButton.addEventListener("click", this._setInstSettings);
            if (isMobile)
                this._optionsMenu.children[1].disabled = true;
        }
        _openPrompt(promptName) {
            this._doc.openPrompt(promptName);
            this._setPrompt(promptName);
        }
        _setPrompt(promptName) {
            if (this.prompt) {
                if (this._wasPlaying)
                    this._play();
                this._wasPlaying = false;
                this._promptContainer.style.display = "none";
                this._promptContainer.removeChild(this.prompt.container);
                this.prompt.cleanUp();
                this.prompt = null;
                this.mainLayer.focus();
            }
            if (promptName) {
                switch (promptName) {
                    case "export":
                        this.prompt = new ExportPrompt(this._doc);
                        break;
                    case "import":
                        this.prompt = new ImportPrompt(this._doc);
                        break;
                    case "duration":
                        this.prompt = new SongDurationPrompt(this._doc);
                        break;
                    case "archive":
                        this.prompt = new ArchivePrompt(this._doc);
                        break;
                    case "instrumentType":
                        this.prompt = new InstrumentTypePrompt(this._doc);
                        break;
                    case "mix":
                        this.prompt = new MixPrompt(this._doc);
                        break;
                    case "chorus":
                        this.prompt = new ChorusPrompt(this._doc);
                        break;
                    case "songdata":
                        this.prompt = new SongDataPrompt(this._doc);
                        break;
                    case "refresh key":
                        this.prompt = new RefreshKeyPrompt(this._doc, this, this._keySelect.selectedIndex);
                        break;
                    case "archive":
                        this.prompt = new ArchivePrompt(this._doc);
                        break;
                    case "themes":
                        this.prompt = new ThemePrompt(this._doc);
                        break;
                    case "songTheme":
                        this.prompt = new SongThemePrompt(this._doc);
                        break;
                    case "layouts":
                        this.prompt = new LayoutPrompt(this._doc);
                        break;
                    default:
                        throw new Error("Unrecognized prompt type.");
                }
                if (this.prompt) {
                    this._wasPlaying = this._doc.synth.playing;
                    this._pause();
                    this._promptContainer.style.display = "";
                    this._promptContainer.appendChild(this.prompt.container);
                }
            }
        }
        updatePlayButton() {
            if (this._doc.synth.playing) {
                this._playButton.classList.remove("playButton");
                this._playButton.classList.add("pauseButton");
                this._playButton.title = "Pause (Space)";
                this._playButton.innerText = "Pause";
            }
            else {
                this._playButton.classList.remove("pauseButton");
                this._playButton.classList.add("playButton");
                this._playButton.title = "Play (Space)";
                this._playButton.innerText = "Play";
            }
        }
        _play() {
            this._doc.synth.play();
            this.updatePlayButton();
        }
        _pause() {
            this._doc.synth.pause();
            if (this._doc.prefs.autoFollow) {
                this._doc.synth.snapToBar(this._doc.bar);
            }
            else {
                this._doc.synth.snapToBar();
            }
            this.updatePlayButton();
        }
        _cut() {
            const pattern = this._doc.getCurrentPattern();
            if (pattern == null)
                return;
            window.localStorage.setItem("patternCopy", JSON.stringify({
                notes: pattern.notes,
                beatsPerBar: this._doc.song.beatsPerBar,
                partsPerBeat: this._doc.song.partsPerBeat,
                drums: this._doc.song.getChannelIsDrum(this._doc.channel),
            }));
            this._doc.record(new ChangePaste(this._doc, pattern, [], this._doc.song.beatsPerBar, this._doc.song.partsPerBeat));
        }
        _copy() {
            const pattern = this._doc.getCurrentPattern();
            let notes = [];
            if (pattern != null)
                notes = pattern.notes;
            const patternCopy = {
                notes: notes,
                beatsPerBar: this._doc.song.beatsPerBar,
                partsPerBeat: this._doc.song.partsPerBeat,
                drums: this._doc.song.getChannelIsDrum(this._doc.channel),
            };
            window.localStorage.setItem("patternCopy", JSON.stringify(patternCopy));
        }
        _paste() {
            const patternCopy = JSON.parse(String(window.localStorage.getItem("patternCopy")));
            if (patternCopy != null && patternCopy.drums == this._doc.song.getChannelIsDrum(this._doc.channel)) {
                new ChangeEnsurePatternExists(this._doc);
                const pattern = this._doc.getCurrentPattern();
                if (pattern == null)
                    throw new Error();
                this._doc.record(new ChangePaste(this._doc, pattern, patternCopy.notes, patternCopy.beatsPerBar, patternCopy.partsPerBeat));
            }
        }
        _transpose(upward) {
            const pattern = this._doc.getCurrentPattern();
            if (pattern == null)
                return;
            const canReplaceLastChange = this._doc.lastChangeWas(this._changeTranspose);
            this._changeTranspose = new ChangeTranspose(this._doc, pattern, upward);
            this._doc.record(this._changeTranspose, canReplaceLastChange);
        }
    }

    class ChangeNotifier {
        constructor() {
            this._watchers = [];
            this._dirty = false;
        }
        watch(watcher) {
            if (this._watchers.indexOf(watcher) == -1) {
                this._watchers.push(watcher);
            }
        }
        unwatch(watcher) {
            const index = this._watchers.indexOf(watcher);
            if (index != -1) {
                this._watchers.splice(index, 1);
            }
        }
        changed() {
            this._dirty = true;
        }
        notifyWatchers() {
            if (!this._dirty)
                return;
            this._dirty = false;
            for (const watcher of this._watchers.concat()) {
                watcher();
            }
        }
    }

    class Selection {
        constructor(_doc) {
            this._doc = _doc;
        }
        muteAllInstruments() {
            let shouldMute = false;
            if (this._doc.song.channels[this._doc.channel].instruments[0].imute == 0) {
                shouldMute = true;
            }
            for (let instrumentIndex = 0; instrumentIndex < this._doc.song.channels[this._doc.channel].instruments.length; instrumentIndex++) {
                this._doc.record(new ChangeAllImute(this._doc, Number(shouldMute), instrumentIndex));
            }
            this._doc.notifier.changed();
        }
        soloChannels(invert) {
            let mutedCounter = 0;
            for (let channelIndex = 0; channelIndex < this._doc.song.channels.length; channelIndex++) {
                for (let instrumentIndex = 0; instrumentIndex < this._doc.song.channels[channelIndex].instruments.length; instrumentIndex++) {
                    if (this._doc.song.channels[channelIndex].instruments[instrumentIndex].imute == (invert ? 0 : 1) && channelIndex != this._doc.channel) {
                        mutedCounter++;
                    }
                    if (channelIndex != this._doc.channel) {
                        this._doc.record(new ChangeSoloChannels(this._doc, Number(!invert), channelIndex, instrumentIndex));
                    }
                    else {
                        this._doc.record(new ChangeSoloChannels(this._doc, Number(invert), channelIndex, instrumentIndex));
                    }
                }
            }
            if (mutedCounter >= this._doc.song.pitchChannelCount + this._doc.song.drumChannelCount - 1) {
                for (let channelIndex = 0; channelIndex < this._doc.song.channels.length; channelIndex++) {
                    for (let instrumentIndex = 0; instrumentIndex < this._doc.song.channels[channelIndex].instruments.length; instrumentIndex++) {
                        this._doc.record(new ChangeSoloChannels(this._doc, Number(invert), channelIndex, instrumentIndex));
                    }
                }
            }
            this._doc.notifier.changed();
        }
        insertChannel() {
            const group = new ChangeGroup();
            const insertIndex = this._doc.channel;
            const isNoise = this._doc.song.getChannelIsDrum(insertIndex);
            group.append(new ChangeAddChannel(this._doc, insertIndex + 1, isNoise));
            if (!group.isNoop()) {
                group.append(new ChangeChannelBar(this._doc, insertIndex, this._doc.bar));
                this._doc.record(group);
            }
            if (!isNoise && this._doc.channel < Config.pitchChannelCountMax - 1) {
                this._doc.channel++;
            }
            if (isNoise && this._doc.channel < Config.drumChannelCountMax + this._doc.song.pitchChannelCount - 1) {
                this._doc.channel++;
            }
        }
    }

    class Preferences {
        constructor() {
            this.autoPlay = localStorage.getItem("autoPlay") == "true";
            this.autoFollow = localStorage.getItem("autoFollow") == "true";
            this.showFifth = localStorage.getItem("showFifth") == "true";
            this.showMore = localStorage.getItem("showMore") == "true";
            this.showLetters = localStorage.getItem("showLetters") == "true";
            this.showChannels = localStorage.getItem("showChannels") == "true";
            this.showScrollBar = localStorage.getItem("showScrollBar") == "true";
            this.showVolumeBar = localStorage.getItem("showVolumeBar") == "true";
            this.advancedSettings = localStorage.getItem("advancedSettings") != "false";
            this.visibleOctaves = Preferences.defaultVisibleOctaves;
            this.layout = localStorage.getItem("layout") || "small";
            this.volume = localStorage.getItem("volume") != null ? Number(localStorage.getItem("volume")) : 75;
        }
        save() {
            localStorage.setItem("autoPlay", this.autoPlay ? "true" : "false");
            localStorage.setItem("autoFollow", this.autoFollow ? "true" : "false");
            localStorage.setItem("showFifth", this.showFifth ? "true" : "false");
            localStorage.setItem("showMore", this.showMore ? "true" : "false");
            localStorage.setItem("showLetters", this.showLetters ? "true" : "false");
            localStorage.setItem("showChannels", this.showChannels ? "true" : "false");
            localStorage.setItem("showScrollBar", this.showScrollBar ? "true" : "false");
            localStorage.setItem("showVolumeBar", this.showVolumeBar ? "true" : "false");
            localStorage.setItem("advancedSettings", this.advancedSettings ? "true" : "false");
            localStorage.setItem("volume", String(this.volume));
        }
    }
    Preferences.defaultVisibleOctaves = 3;

    class SongDocument {
        constructor(string) {
            this.notifier = new ChangeNotifier();
            this.selection = new Selection(this);
            this.channel = 0;
            this.bar = 0;
            this.trackVisibleBars = 16;
            this.barScrollPos = 0;
            this.prompt = null;
            this.prefs = new Preferences();
            this._recentChange = null;
            this._sequenceNumber = 0;
            this._barFromCurrentState = 0;
            this._channelFromCurrentState = 0;
            this._shouldPushState = false;
            this._waitingToUpdateState = false;
            this._whenHistoryStateChanged = () => {
                let state = window.history.state;
                if (state && state.sequenceNumber == this._sequenceNumber)
                    return;
                if (state == null) {
                    this._sequenceNumber++;
                    state = { canUndo: true, sequenceNumber: this._sequenceNumber, bar: this.bar, channel: this.channel, prompt: this.prompt };
                    new ChangeSong(this, location.hash);
                    window.history.replaceState(state, "", "#" + this.song.toBase64String());
                }
                else {
                    if (state.sequenceNumber == this._sequenceNumber - 1) {
                        this.bar = this._barFromCurrentState;
                        this.channel = this._channelFromCurrentState;
                    }
                    else if (state.sequenceNumber != this._sequenceNumber) {
                        this.bar = state.bar;
                        this.channel = state.channel;
                    }
                    this._sequenceNumber = state.sequenceNumber;
                    this.prompt = state.prompt;
                    new ChangeSong(this, location.hash);
                }
                this._barFromCurrentState = state.bar;
                this._channelFromCurrentState = state.channel;
                this.forgetLastChange();
                this.notifier.notifyWatchers();
            };
            this._cleanDocument = () => {
                this.notifier.notifyWatchers();
            };
            this._updateHistoryState = () => {
                this._waitingToUpdateState = false;
                const hash = "#" + this.song.toBase64String();
                let state;
                if (this._shouldPushState) {
                    this._sequenceNumber++;
                    state = { canUndo: true, sequenceNumber: this._sequenceNumber, bar: this.bar, channel: this.channel, prompt: this.prompt };
                    window.history.pushState(state, "", hash);
                }
                else {
                    state = { canUndo: true, sequenceNumber: this._sequenceNumber, bar: this.bar, channel: this.channel, prompt: this.prompt };
                    window.history.replaceState(state, "", hash);
                }
                this._barFromCurrentState = state.bar;
                this._channelFromCurrentState = state.channel;
                this._shouldPushState = false;
            };
            this.song = new Song(string);
            this.synth = new Synth(this.song);
            this.synth.volume = this._calcVolume();
            if (this.song.setSongTheme == "none") {
                if (window.localStorage.getItem("modboxTheme") != null) {
                    ColorConfig.setTheme(String(window.localStorage.getItem("modboxTheme")));
                }
                else {
                    window.localStorage.setItem("modboxTheme", "default");
                    ColorConfig.setTheme("default");
                }
            }
            else {
                ColorConfig.setTheme(this.song.setSongTheme);
            }
            if (window.localStorage.getItem("layout") != null) {
                Layout.setLayout(String(window.localStorage.getItem("layout")));
            }
            else {
                window.localStorage.setItem("layout", "small");
                Layout.setLayout("small");
            }
            let state = window.history.state;
            if (state == null) {
                state = { canUndo: false, sequenceNumber: 0, bar: 0, channel: 0, prompt: null };
                window.history.replaceState(state, "", "#" + this.song.toBase64String());
            }
            window.addEventListener("hashchange", this._whenHistoryStateChanged);
            window.addEventListener("popstate", this._whenHistoryStateChanged);
            this.bar = state.bar;
            this.channel = state.channel;
            this._barFromCurrentState = state.bar;
            this._channelFromCurrentState = state.channel;
            this.barScrollPos = Math.max(0, this.bar - (this.trackVisibleBars - 6));
            this.prompt = state.prompt;
            for (const eventName of ["input", "change", "click", "keyup", "keydown", "mousedown", "mousemove", "mouseup", "touchstart", "touchmove", "touchend", "touchcancel"]) {
                window.addEventListener(eventName, this._cleanDocument);
            }
        }
        record(change, replaceState = false) {
            if (change.isNoop()) {
                this._recentChange = null;
                if (replaceState) {
                    window.history.back();
                }
            }
            else {
                this._recentChange = change;
                if (!replaceState) {
                    this._shouldPushState = true;
                }
                if (!this._waitingToUpdateState) {
                    window.requestAnimationFrame(this._updateHistoryState);
                    this._waitingToUpdateState = true;
                }
            }
        }
        openPrompt(prompt) {
            this.prompt = prompt;
            const hash = "#" + this.song.toBase64String();
            this._sequenceNumber++;
            const state = { canUndo: true, sequenceNumber: this._sequenceNumber, bar: this.bar, channel: this.channel, prompt: this.prompt };
            window.history.pushState(state, "", hash);
        }
        undo() {
            const state = window.history.state;
            if (state.canUndo)
                window.history.back();
        }
        redo() {
            window.history.forward();
        }
        setProspectiveChange(change) {
            this._recentChange = change;
        }
        forgetLastChange() {
            this._recentChange = null;
        }
        lastChangeWas(change) {
            return change != null && change == this._recentChange;
        }
        setVolume(val) {
            this.prefs.volume = val;
            this.prefs.save();
            this.synth.volume = this._calcVolume();
        }
        getMobileLayout() {
            return window.innerWidth <= 710;
        }
        getFullScreen() {
            return !this.getMobileLayout() && (this.prefs.layout != "small");
        }
        _calcVolume() {
            return Math.min(1.0, Math.pow(this.prefs.volume / 50.0, 0.5)) * Math.pow(2.0, (this.prefs.volume - 75.0) / 25.0);
        }
        getCurrentPattern() {
            return this.song.getPattern(this.channel, this.bar);
        }
        getCurrentInstrument() {
            const pattern = this.getCurrentPattern();
            return pattern == null ? 0 : pattern.instrument;
        }
        getVisibleOctaveCount() {
            return this.getFullScreen() ? this.prefs.visibleOctaves : Preferences.defaultVisibleOctaves;
        }
        getVisiblePitchCount() {
            return this.getVisibleOctaveCount() * Config.pitchesPerOctave + 1;
        }
        getBaseVisibleOctave(channel) {
            const visibleOctaveCount = this.getVisibleOctaveCount();
            return Math.max(0, Math.min(Config.pitchOctaves - visibleOctaveCount, Math.ceil(this.song.channels[channel].octave - visibleOctaveCount * 0.5)));
        }
    }

    document.head.appendChild(HTML.style({ type: "text/css" }, `

:root {
--drum-symbol: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40"> \
			<defs> \
				<linearGradient id="gold1" x1="0%" y1="0%" x2="100%" y2="0%"> \
					<stop offset="0%" stop-color="%237e3302"/> \
					<stop offset="40%" stop-color="%23ffec6b"/> \
					<stop offset="100%" stop-color="%237e3302"/> \
				</linearGradient> \
				<linearGradient id="gold2" x1="0%" y1="0%" x2="100%" y2="0%"> \
					<stop offset="0%" stop-color="%23faaf7d"/> \
					<stop offset="15%" stop-color="%23fffba9"/> \
					<stop offset="40%" stop-color="%23ffffe3"/> \
					<stop offset="65%" stop-color="%23fffba9"/> \
					<stop offset="100%" stop-color="%23faaf7d"/> \
				</linearGradient> \
				<radialGradient id="gold3" cx="0%" cy="0%" r="100%"> \
					<stop offset="0%" stop-color="%23ffffe3"/> \
					<stop offset="50%" stop-color="%23ffec6b"/> \
					<stop offset="100%" stop-color="%237e3302"/> \
				</radialGradient> \
				<linearGradient id="red" x1="0%" y1="0%" x2="100%" y2="0%"> \
					<stop offset="0%" stop-color="%23641919"/> \
					<stop offset="40%" stop-color="%23cd2c2c"/> \
					<stop offset="100%" stop-color="%23641919"/> \
				</linearGradient> \
				<radialGradient id="membrane"> \
					<stop offset="10%" stop-color="%23cccccc" /> \
					<stop offset="90%" stop-color="%23f6f6f7" /> \
					<stop offset="100%" stop-color="%23999" /> \
				</radialGradient> \
			</defs> \
			<ellipse cx="16" cy="26" rx="16" ry="14" fill="rgba(0,0,0,0.5)"/> \
			<ellipse cx="16" cy="25" rx="16" ry="14" fill="url(%23gold1)"/> \
			<rect x="0" y="23" width="32" height="2" fill="url(%23gold1)"/> \
			<ellipse cx="16" cy="23" rx="16" ry="14" fill="url(%23gold2)"/> \
			<ellipse cx="16" cy="23" rx="15" ry="13" fill="url(%23red)"/> \
			<rect x="1" y="17" width="30" height="6" fill="url(%23red)"/> \
			<rect x="5" y="27" width="1" height="5" rx="0.5" fill="rgba(0,0,0,0.5)"/> \
			<rect x="15" y="31" width="2" height="5" rx="1" fill="rgba(0,0,0,0.5)"/> \
			<rect x="26" y="27" width="1" height="5" rx="0.5" fill="rgba(0,0,0,0.5)"/> \
			<rect x="5" y="26" width="1" height="5" rx="0.5" fill="url(%23gold3)"/> \
			<rect x="15" y="30" width="2" height="5" rx="1" fill="url(%23gold3)"/> \
			<rect x="26" y="26" width="1" height="5" rx="0.5" fill="url(%23gold3)"/> \
			<ellipse cx="16" cy="18" rx="15" ry="13" fill="rgba(0,0,0,0.5)"/> \
			<ellipse cx="16" cy="16" rx="16" ry="14" fill="url(%23gold1)"/> \
			<rect x="0" y="14" width="32" height="2" fill="url(%23gold1)"/> \
			<ellipse cx="16" cy="14" rx="16" ry="14" fill="url(%23gold2)"/> \
			<ellipse cx="16" cy="14" rx="15" ry="13" fill="url(%23membrane)"/> \
		</svg>');
	--piano-key-symbol: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="15" preserveAspectRatio="none" viewBox="0 -1 32 15"> \
			<defs> \
				<linearGradient id="shadow" x1="0%" y1="0%" x2="100%" y2="0%"> \
					<stop offset="0%" stop-color="rgba(0,0,0,0.5)"/> \
					<stop offset="100%" stop-color="transparent"/> \
				</linearGradient> \
			</defs> \
			<rect x="-1" y="1" width="31" height="1" rx="0.6" fill="rgba(255,255,255,0.4)"/> \
			<path d="M -1 11 L 30 11 L 30 2 L 33 -1 L 33 14 L -1 14 z" fill="rgba(0,0,0,0.7)"/> \
			<rect x="-1" y="-1" width="19" height="15" fill="url(%23shadow)"/> \
		</svg>');
}

html {
background: ${ColorConfig.pageMargin};
}

.beepboxEditor .drum-button {
	flex: 1;
	background-color: transparent;
	background-image: var(--drum-symbol);
	background-repeat: no-repeat;
	background-position: center;
}

.beepboxEditor .piano-button.pressed, .beepboxEditor .drum-button.pressed {
	filter: brightness(0.5);
}

.beepboxEditor .piano-button {
	flex: 1;
	position: relative;
	display: flex;
	align-items: center;
}
.beepboxEditor .piano-button::before {
	content: "";
	position: absolute;
	left: 0;
	top: 0;
	width: 100%;
	height: 100%;
	pointer-events: none;
	background-image: var(--piano-key-symbol);
	background-repeat: no-repeat;
	background-position: center;
	background-size: 100% 115.38%;
}
.beepboxEditor .piano-button.disabled::after {
	content: "";
	position: absolute;
	right: 0;
	top: 0;
	width: 70%;
	height: 100%;
	pointer-events: none;
	background: ${ColorConfig.editorBackground};
	-webkit-mask-image: linear-gradient(90deg, transparent 0%, gray 70%, gray 100%);
	-webkit-mask-repeat: no-repeat;
	-webkit-mask-position: center;
	mask-image: linear-gradient(90deg, transparent 0%, gray 70%, gray 100%);
	mask-repeat: no-repeat;
	mask-position: center;
}

.beepboxEditor .piano-button.pressed, .beepboxEditor .drum-button.pressed {
	filter: brightness(0.5);
}

.beepboxEditor {
	display: grid;
	grid-template-areas: "pattern-area settings-area advanced-settings-area" "pattern-area   song-settings-area advanced-settings-area" "track-area   song-settings-area advanced-settings-area";
	-webkit-touch-callout: none;
	-webkit-user-select: none;
	-khtml-user-select: none;
	-moz-user-select: none;
	-ms-user-select: none;
	user-select: none;
	position: relative;
	touch-action: manipulation;
	cursor: default;
	font-size: small;
	background: ${ColorConfig.editorBackground};
}

.beepboxEditor .theme-option input:checked ~ * {
	color: #fff;
}

.beepboxEditor .theme-option {
	color: #999;
}


.hintButton {
	width: 0.5em; 
	display: flex; 
	align-items: center;
}

.beepboxEditor div {
	margin: 0;
	padding: 0;
}

.beepboxEditor .promptContainer {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	/*background: rgba(0,0,0,0.5);*/
	display: flex;
	justify-content: center;
	align-items: center;
}

.beepboxEditor .prompt {
	margin: auto;
	text-align: center;
	background: ${ColorConfig.editorBackground};
	border-radius: 15px;
	border: 4px solid #444;
	color: #fff;
	padding: 20px;
	display: flex;
	flex-direction: column;
}

.beepboxEditor .prompt > *:not(:first-child) {
	margin-top: 1.5em;
}

/* Use psuedo-elements to add cross-browser up & down arrows to select elements: */
.beepboxEditor .selectContainer {
	position: relative;
}
.beepboxEditor .selectContainer:not(.menu)::before {
	content: "";
	position: absolute;
	right: 0.3em;
	top: 0.4em;
	border-bottom: 0.4em solid currentColor;
	border-left: 0.3em solid transparent;
	border-right: 0.3em solid transparent;
	pointer-events: none;
}
.beepboxEditor .selectContainer:not(.menu)::after {
	content: "";
	position: absolute;
	right: 0.3em;
	bottom: 0.4em;
	border-top: 0.4em solid currentColor;
	border-left: 0.3em solid transparent;
	border-right: 0.3em solid transparent;
	pointer-events: none;
}
.beepboxEditor .selectContainer.menu::after {
	content: "";
	position: absolute;
	right: 0.7em;
	margin: auto;
	top: 0;
	bottom: 0;
	height: 0;
	border-top: 0.4em solid currentColor;
	border-left: 0.3em solid transparent;
	border-right: 0.3em solid transparent;
	pointer-events: none;
}
.beepboxEditor select {
	margin: 0;
	padding: 0 0.3em;
	display: block;
	height: 2em;
	border: none;
	border-radius: 0.4em;
	background: ${ColorConfig.uiWidgetBackground};
	color: inherit;
	font-size: inherit;
	cursor: pointer;
	font-family: inherit;

	-webkit-appearance:none;
	-moz-appearance: none;
	appearance: none;
}
.beepboxEditor .menu select {
	padding: 0 2em;
}
.beepboxEditor select:focus {
	background: ${ColorConfig.uiWidgetFocus};
	outline: none;
}
.beepboxEditor .menu select {
	text-align: center;
	text-align-last: center;
}

/* This makes it look better in firefox on my computer... What about others?
@-moz-document url-prefix() {
	.beepboxEditor select { padding: 0 2px; }
}
*/
.beepboxEditor button {
	margin: 0;
	position: relative;
	height: 2em;
	border: none;
	border-radius: 0.4em;
	background: ${ColorConfig.uiWidgetBackground};
	color: inherit;
	font-size: inherit;
	font-family: inherit;
	cursor: pointer;
}
.beepboxEditor .numberInput {
	width: 3em !important;
  	margin-left: 1em;
}
.beepboxEditor button:focus {
	background: ${ColorConfig.uiWidgetFocus};
	outline: none;
}
.beepboxEditor button.playButton, .beepboxEditor button.pauseButton {
	padding-left: 2em;
}
.beepboxEditor button.playButton::before {
	content: "";
	position: absolute;
	left: 0.7em;
	top: 50%;
	margin-top: -0.65em;
	border-left: 1em solid currentColor;
	border-top: 0.65em solid transparent;
	border-bottom: 0.65em solid transparent;
	pointer-events: none;
}
.beepboxEditor button.pauseButton::before {
	content: "";
	position: absolute;
	left: 0.7em;
	top: 50%;
	margin-top: -0.65em;
	width: 0.3em;
	height: 1.3em;
	background: currentColor;
	pointer-events: none;
}
.beepboxEditor button.pauseButton::after {
	content: "";
	position: absolute;
	left: 1.4em;
	top: 50%;
	margin-top: -0.65em;
	width: 0.3em;
	height: 1.3em;
	background: currentColor;
	pointer-events: none;
}

.beepboxEditor button.prevBarButton::before {
	content: "";
	position: absolute;
	left: 50%;
	top: 50%;
	margin-left: -0.5em;
	margin-top: -0.5em;
	width: 0.2em;
	height: 1em;
	background: currentColor;
	pointer-events: none;
}
.beepboxEditor button.prevBarButton::after {
	content: "";
	position: absolute;
	left: 50%;
	top: 50%;
	margin-left: -0.3em;
	margin-top: -0.5em;
	border-right: 0.8em solid currentColor;
	border-top: 0.5em solid transparent;
	border-bottom: 0.5em solid transparent;
	pointer-events: none;
}

.beepboxEditor .song-settings-area {
	grid-area: song-settings-area;
}

.beepboxEditor button.nextBarButton::before {
	content: "";
	position: absolute;
	left: 50%;
	top: 50%;
	margin-left: -0.5em;
	margin-top: -0.5em;
	border-left: 0.8em solid currentColor;
	border-top: 0.5em solid transparent;
	border-bottom: 0.5em solid transparent;
	pointer-events: none;
}
.beepboxEditor button.nextBarButton::after {
	content: "";
	position: absolute;
	left: 50%;
	top: 50%;
	margin-left: 0.3em;
	margin-top: -0.5em;
	width: 0.2em;
	height: 1em;
	background: currentColor;
	pointer-events: none;
}

.beepboxEditor canvas {
	overflow: hidden;
	position: absolute;
	display: block;
}

.beepboxEditor .trackContainer {
	overflow-x: hidden;
}

.beepboxEditor .trackAndMuteContainer {
	display: flex;
	align-items: flex-start;
	width: 100%;
	min-height: 0;
	flex: 1;
	overflow-x: hidden;
	position: relative;
}

.beepboxEditor .selectRow {
	margin: 0;
	height: 2.5em;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
}

.beepboxEditor .selectRow > span {
	color: ${ColorConfig.secondaryText};
}

.beepboxEditor .inputRow {
	margin: 0;
	height: 2.5em;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
}

.beepboxEditor .inputRow > span {
	color: ${ColorConfig.secondaryText};
}

.beepboxEditor .operatorRow {
	margin: 0;
	height: 2.5em;
	display: flex;
	flex-direction: row;
	align-items: center;
}

.beepboxEditor .operatorRow > * {
	flex-grow: 1;
	flex-shrink: 1;
}

.beepboxEditor .settings-area {
	display: flex;
	flex-direction: column;
}

.beepboxEditor .editor-widgets {
	display: flex;
	flex-direction: column;
}

.beepboxEditor .editor-menus {
	display: flex;
	flex-direction: column;
}

.beepboxEditor .editor-settings {
	display: flex;
	flex-direction: column;
	margin-left: 6px;
}

.beepboxEditor .layout-option {
	display: flex;
	flex-direction: column;
	cursor: pointer;
	color: ${ColorConfig.secondaryText};
	width: 25%;
}

.beepboxEditor .layout-option input {
	display: none;
}

.beepboxEditor .layout-option input:checked ~ * {
	color: ${ColorConfig.primaryText};
}

.beepboxEditor .editor-song-settings {
	display: flex;
	flex-direction: column;
}

.beepboxEditor .editor-instrument-settings {
	display: flex;
	flex-direction: column;
}
.beepboxEditor .advanced-settings-area {
	display: flex;
	flex-direction: column;
	grid-area: advanced-settings-area;
}

.beepboxEditor .editorBox {
	grid-area: pattern-area;
}

.beepboxEditor .track-area {
	grid-area: track-area;
}

.beepboxEditor .editor-right-menus {
	display: flex;
	flex-direction: column;
}

.beepboxEditor .editor-right-settings {
	display: flex;
	flex-direction: column;
}

.beepboxEditor .editor-right-song-settings {
	display: flex;
	flex-direction: column;
}

.beepboxEditor .editor-right-instrument-settings {
	display: flex;
	flex-direction: column;
}

.beepboxEditor .editor-right-side-top > *, .beepboxEditor .editor-right-side-bottom > * {
	flex-shrink: 0;
}

.beepboxEditor input[type=text], .beepboxEditor input[type=number] {
	font-size: inherit;
	background: transparent;
	border: 1px solid #777;
	color: white;
}

.beepboxEditor input[type=checkbox] {
  transform: scale(1.5);
}

.beepboxEditor input[type=range] {
	-webkit-appearance: none;
	color: inherit;
	width: 100%;
	height: 2em;
	font-size: inherit;
	margin: 0;
	cursor: pointer;
	background-color: ${ColorConfig.editorBackground};
	touch-action: pan-y;
}
.beepboxEditor input[type=range]:focus {
	outline: none;
}
.beepboxEditor input[type=range]::-webkit-slider-runnable-track {
	width: 100%;
	height: 0.5em;
	cursor: pointer;
	background: ${ColorConfig.uiWidgetBackground};
}
.beepboxEditor input[type=range]::-webkit-slider-thumb {
	height: 2em;
	width: 0.5em;
	border-radius: 0.25em;
	background: currentColor;
	cursor: pointer;
	-webkit-appearance: none;
	margin-top: -0.75em;
}
.beepboxEditor input[type=range]:focus::-webkit-slider-runnable-track {
	background: ${ColorConfig.uiWidgetFocus};
}
.beepboxEditor input[type=range]::-moz-range-track {
	width: 100%;
	height: 0.5em;
	cursor: pointer;
	background: ${ColorConfig.uiWidgetBackground};
}
.beepboxEditor input[type=range]:focus::-moz-range-track {
	background: ${ColorConfig.uiWidgetFocus};
}
.beepboxEditor input[type=range]::-moz-range-thumb {
	height: 2em;
	width: 0.5em;
	border-radius: 0.25em;
	border: none;
	background: currentColor;
	cursor: pointer;
}
.beepboxEditor input[type=range]::-ms-track {
	width: 100%;
	height: 0.5em;
	cursor: pointer;
	background: ${ColorConfig.uiWidgetBackground};
	border-color: transparent;
}
.beepboxEditor input[type=range]:focus::-ms-track {
	background: ${ColorConfig.uiWidgetFocus};
}
.beepboxEditor input[type=range]::-ms-thumb {
	height: 2em;
	width: 0.5em;
	border-radius: 0.25em;
	background: currentColor;
	cursor: pointer;
}
.beepboxEditor .hintButton {
	border: 1px solid currentColor;
	border-radius: 50%;
	text-decoration: none;
	height: 1em;
	text-align: center;
	margin-right: .4em;
	cursor: pointer;
}

/* wide screen */
@media (min-width: 501px) {
	#beepboxEditorContainer {
		display: table;
	}
	.beepboxEditor {
		flex-direction: row;
	}
	.beepboxEditor:focus-within {
		outline: 3px solid #555;
	}
	.beepboxEditor .trackContainer {
		width: 512px;
		grid-area: track-editor;
	}
	.beepboxEditor .trackSelectBox {
		display: none;
	}
	.beepboxEditor .playback-controls {
		display: flex;
		flex-direction: column;
	}
	.beepboxEditor .playback-bar-controls {
		display: flex;
		flex-direction: row;
		margin: .2em 0;
	}
	.beepboxEditor .playback-volume-controls {
		display: flex;
		flex-direction: row;
		margin: .2em 0;
		align-items: center;
	}
	.beepboxEditor .pauseButton, .beepboxEditor .playButton {
		flex-grow: 1;
	}
	.beepboxEditor .nextBarButton, .beepboxEditor .prevBarButton {
		flex-grow: 1;
		margin-left: 10px;
	}
	.beepboxEditor .settings-area {
		margin-left: 6px;
		width: 14em;
		flex-direction: column;
		grid-area: settings-area;
	}
	.beepboxEditor .advanced-settings-area {
		margin-left: 6px;
		width: 14em;
		flex-direction: column;
	}
	.beepboxEditor .editor-widgets {
		flex-grow: 1;
	}
	.beepboxEditor .editor-right-widgets {
		flex-grow: 1;
	}
	.beepboxEditor .editor-settings input, .beepboxEditor .editor-settings select {
		width: 8.6em;
	}
	.beepboxEditor .editor-right-settings input, .beepboxEditor .editor-right-settings select {
		width: 8.6em;
	}
	.beepboxEditor .editor-menus > * {
		flex-grow: 1;
		margin: .2em 0;
	}
	.beepboxEditor .editor-right-menus > * {
		flex-grow: 1;
		margin: .2em 0;
	}
	.beepboxEditor .editor-menus > button {
		padding: 0 2em;
		white-space: nowrap;
	}
	.beepboxEditor .editor-right-menus > button {
		padding: 0 2em;
		white-space: nowrap;
	}
}

/* narrow screen */
@media (max-width: 500px) {
	.beepboxEditor {
		flex-direction: column;
	}
	.beepboxEditor:focus-within {
		outline: none;
	}
	.beepboxEditor .editorBox {
		max-height: 75vh;
		grid-area: pattern-area;
	}
	.beepboxEditor .editor-menus {
		flex-direction: row;
	}
	.beepboxEditor .editor-right-menus {
		flex-direction: row;
	}
	.beepboxEditor .editor-menus > * {
		flex-grow: 1;
		margin: .10em;
	}
	.beepboxEditor .editor-right-menus > * {
		flex-grow: 1;
		margin: .2em;
	}
	.beepboxEditor .editor-menus > button {
		padding-left: 2em;
		white-space: nowrap;
	}
	.beepboxEditor .editor-right-menus > button {
		padding-left: 2em;
		white-space: nowrap;
	}
	.beepboxEditor .trackContainer {
		overflow-x: auto;
	}
	.beepboxEditor .barScrollBar {
		display: none;
	}
	.beepboxEditor .playback-controls {
		display: flex;
		flex-direction: row;
		margin: .2em 0;
	}
	.beepboxEditor .playback-bar-controls {
		display: flex;
		flex-direction: row;
		flex-grow: 1;
	}
	.beepboxEditor .playback-volume-controls {
		display: flex;
		flex-direction: row;
		align-items: center;
		flex-grow: 1;
		margin: 0 .2em;
	}
	.beepboxEditor .settings-area {
		flex-direction: column-reverse;
	}
	.beepboxEditor .editor-settings {
		flex-direction: row;
		margin-left: 6px;
	}
	.beepboxEditor .advanced-settings-area {
		flex-direction: column-reverse;
	}
	.beepboxEditor .editor-right-settings {
		flex-direction: row;
	}
	.beepboxEditor .pauseButton, .beepboxEditor .playButton,
	.beepboxEditor .nextBarButton, .beepboxEditor .prevBarButton {
		flex-grow: 1;
		margin: 0 .2em;
	}
	.beepboxEditor .editor-song-settings, .beepboxEditor .editor-instrument-settings {
		flex-grow: 1;
		margin: 0 .2em;
	}
	.beepboxEditor .editor-right-song-settings, .beepboxEditor .editor-right-instrument-settings {
		flex-grow: 1;
		margin: 0 .2em;
	}
	.beepboxEditor .editor-settings input, .beepboxEditor .editor-settings .selectContainer {
		width: 60%;
	}
	.beepboxEditor .editor-right-settings input, .beepboxEditor .editor-right-settings .selectContainer {
		width: 60%;
	}
	.beepboxEditor .editor-settings select {
		width: 100%;
	}
	.beepboxEditor .editor-right-settings select {
		width: 100%;
	}
	.fullWidthOnly {
		display: none;
	}
	p {
		margin: 1em 0.5em;
	}
}
`));

    const doc = new SongDocument(location.hash);
    const editor = new SongEditor(doc);
    const beepboxEditorContainer = document.getElementById("beepboxEditorContainer");
    beepboxEditorContainer.appendChild(editor.mainLayer);
    editor.whenUpdated();
    editor.mainLayer.focus();
    if (!isMobile && doc.prefs.autoPlay) {
        function autoplay() {
            if (!document.hidden) {
                doc.synth.play();
                editor.updatePlayButton();
                window.removeEventListener("visibilitychange", autoplay);
            }
        }
        if (document.hidden) {
            window.addEventListener("visibilitychange", autoplay);
        }
        else {
            autoplay();
        }
    }
    if ("scrollRestoration" in history)
        history.scrollRestoration = "manual";
    editor.updatePlayButton();
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/service_worker.js", { updateViaCache: "all", scope: "/" }).catch(() => { });
    }

    exports.Channel = Channel;
    exports.Config = Config;
    exports.ExportPrompt = ExportPrompt;
    exports.Instrument = Instrument;
    exports.Pattern = Pattern;
    exports.Song = Song;
    exports.SongDocument = SongDocument;
    exports.SongEditor = SongEditor;
    exports.Synth = Synth;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

})({});
//# sourceMappingURL=beepbox_editor.js.map
