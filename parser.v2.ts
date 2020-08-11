type YesOrNo = "y" | "n";

interface Stimulus {
  stimulusType?: StimulusType;
  identifier?: string;
  content?: string;
  button?: boolean;
  filePath?: string | null;
  fontSize?: number | null;
  fontColor?: string | null;
}

interface Sequence {
  onSetTime?: number | null;
  stimulus: Stimulus;
  stimulusDuration?: number | null;
  choices?: Stimulus[] | null;
  choiceDuration?: number | null;
  answer?: number | null;
  choiceOnsetRelativeToSim?: number | null;
  reactionTime?: number | null;
  feedbackType?: FeedbackType;
  feedbackDuration?: number | null;
  test?: boolean;
  feedback1?: Stimulus | null;
  feedback2?: Stimulus | null;
}

enum StimulusType {
  IMAGE = "image",
  TEXT = "text",
  TEXT_FILE = "text_file",
  AUDIO = "audio",
  VIDEO = "video",
  INSTRUCTION = "instruction",
  RESULT = "result",
}

enum FeedbackType {
  NONE = "n",
  TRUE_OR_FALSE = "tf",
  ALWAYS = "a",
  CHOICE = "c",
}

function splitWithEscapedCharacter(
  text: string,
  splitChar: string,
  pairChar: string
): string[] {
  text = text + splitChar;
  let isPairOpen = false;
  let resultArray = [];
  let wordBuffer = [];

  for (let char of text) {
    switch (char) {
      case pairChar:
        isPairOpen = !isPairOpen;
        break;

      case splitChar:
        if (isPairOpen) {
          wordBuffer.push(char);
        } else {
          // add to resultArray and flush wordBuffer
          const completedWord = wordBuffer.join("");
          resultArray.push(completedWord);
          wordBuffer = [];
        }
        break;
      default:
        wordBuffer.push(char);
        break;
    }
  }

  return resultArray;
}

class Parser {
  // after constructor()
  rows: string[];

  // after splitRowsIntoSection()
  stimulusRows: string[];
  preSequenceRows: string[];
  mainSequenceRows: string[];
  postSequenceRows: string[];

  // after parseStimulus()
  stimulus: any;

  // after parseAllSequences()
  sequences: any;

  constructor(rawInput: string) {
    this.rows = rawInput.split("\n").map((row: string) => row.trim());

    this.stimulusRows = [];
    this.preSequenceRows = [];
    this.mainSequenceRows = [];
    this.postSequenceRows = [];

    this.stimulus = {};
    this.sequences = {};
  }

  execute() {
    this.splitRowsIntoSection();
    this.parseStimulusRows();
    this.parseAllSequences();
    return this;
  }

  detectSectionStartAndEnd(keyword: string) {
    let sectionStartIndex: number | null = null;
    let sectionEndIndex: number | null = null;

    for (let index = 0; index < this.rows.length; index++) {
      const instruction: string = this.rows[index];
      const isSectionStartInstruction: boolean = instruction == `[${keyword}]`;
      const isSectionEndInstruction: boolean = instruction == `[End${keyword}]`;

      if (isSectionStartInstruction) {
        sectionStartIndex = index;
      } else if (isSectionEndInstruction) {
        sectionEndIndex = index;
        break;
      }
    }

    return { sectionStartIndex, sectionEndIndex };
  }

  splitSections(keyword: string): string[] {
    const {
      sectionStartIndex,
      sectionEndIndex,
    } = this.detectSectionStartAndEnd(keyword);

    if (sectionStartIndex === null || sectionEndIndex === null) {
      throw new Error("섹션 파싱에 실패했습니다.");
    } else {
      return this.rows.slice(sectionStartIndex + 1, sectionEndIndex);
    }
  }

  getStimulusByIdentifier(stimulusIdentifier: string): Stimulus {
    const found = this.stimulus[stimulusIdentifier];
    if (found) {
      return found as Stimulus;
    } else {
      throw new Error(`Stimulus Identifier ${stimulusIdentifier} is not valid`);
    }
  }

  splitRowsIntoSection() {
    this.stimulusRows = this.splitSections("Descriptions");
    this.preSequenceRows = this.splitSections("PreSeq");
    this.mainSequenceRows = this.splitSections("MainSeq");
    this.postSequenceRows = this.splitSections("PostSeq");
  }

  parseStimulusRow(row: string): Stimulus {
    let stimulus: Stimulus = {};

    // 띄어쓰기로 row를 분리하여 토큰 array로 저장(큰따옴표(") 내부에 있는 띄어쓰기는 무시))
    // ex) text1 T1 "you have 2 apples" n n
    // => splittedRow : ["text1", "T1", "you have 2 apples", "n", "n"]
    const tokens: string[] = splitWithEscapedCharacter(row, " ", '"');

    // 첫 토큰 2개 추출
    const [stimulusType, identifier] = tokens;
    stimulus.stimulusType = stimulusType as StimulusType;
    stimulus.identifier = identifier;

    // 나머지 토큰들은 Stimulus Type에 따라 배치가 다르기 때문에 switch 문으로 분리
    const left = tokens.slice(2);

    switch (stimulusType) {
      case StimulusType.IMAGE:
        var [
          filePath, // ex) 'img/3.png'
          button, // true, false => 어떤 값이든 있으면 true, false
        ] = left;
        stimulus = { ...stimulus, filePath, button: !!button };
        break;
      case StimulusType.TEXT:
        var [content, fontSize, fontColor] = left;
        stimulus = {
          ...stimulus,
          content,
          fontSize: fontSize === "n" ? null : parseInt(fontSize),
          fontColor: fontColor === "n" ? null : fontColor,
        };
        break;
      case StimulusType.TEXT_FILE:
        var [filePath, fontSize, fontColor] = left;
        stimulus = {
          ...stimulus,
          filePath,
          fontSize: fontSize === "n" ? null : parseInt(fontSize),
          fontColor: fontColor === "n" ? null : fontColor,
        };
        break;
      case StimulusType.AUDIO:
      case StimulusType.VIDEO:
        var [filePath] = tokens;
        stimulus = { ...stimulus, filePath };
        break;
      default:
        throw new Error(`${stimulusType}은 유효한 자극 유형이 아닙니다`);
    }

    return stimulus;
  }

  parseStimulusRows() {
    for (let index = 0; index < this.stimulusRows.length; index++) {
      const stimulusRow: string = this.stimulusRows[index];
      // const stimulus = Stimulus.FromRow(row);
      const stimulus = this.parseStimulusRow(stimulusRow);

      if (stimulus.identifier) {
        this.stimulus[stimulus.identifier] = stimulus;
      } else {
        throw new Error("identifier가 존재하지 않습니다");
      }
    }
  }

  parseSequenceRow(row: string): Sequence {
    const tokens = row.split(" ");

    // 토큰 추출
    const [
      onSetTime, // 0: number(ms)
      identifier, // 1: string
      stimulusDuration, // 2: number(ms) | inf
      choices, // 3: n | comma seperated identifiers(<identifier>,<identifier>)
      choiceDuration, // 4: number(ms) | inf
      answer, // 5: n | index of the choice
      choiceOnsetRelativeToSim, // 6 : number(ms)
      reactionTime, // 7 : number(ms)
      feedbackType, // 8 : n | tf | a | c => none, true or false, always, choice
      feedbackDuration, // 9 : n | number(ms)
      feedback1, // 10 n | => when feedbackType is tf or a
      feedback2, // 11 n | => when feedbackType is tf
      test, // 12 => considered when calculting accuracy
    ] = tokens;

    // Process & pack stimulus
    let sequence: Sequence = {
      onSetTime: +onSetTime,
      stimulus: this.stimulus[identifier] || null,
      stimulusDuration:
        stimulusDuration === "inf" || stimulusDuration === "n"
          ? null
          : +stimulusDuration,
      choices:
        choices === "n"
          ? null
          : choices
              .split(",") // ['s1', 's2']
              .map((identifier: string) => {
                return this.getStimulusByIdentifier(identifier);
              }),
      // [{type: 'image', body: 'img/2.png', font_color: null, font_size: null}, {...}]
      choiceDuration:
        choiceDuration === "inf" || choiceDuration === "n"
          ? null
          : +choiceDuration,
      answer: answer === "n" ? null : +answer,
      choiceOnsetRelativeToSim:
        choiceOnsetRelativeToSim == "inf" || choiceOnsetRelativeToSim == "n"
          ? null
          : +choiceOnsetRelativeToSim,
      reactionTime:
        reactionTime == "n" || reactionTime == "inf" ? null : +reactionTime,
      feedbackType: feedbackType as FeedbackType,
      feedbackDuration:
        feedbackDuration == "n" || feedbackDuration == "inf"
          ? null
          : +feedbackDuration,
      test: test == "y",
    };

    switch (feedbackType) {
      case FeedbackType.ALWAYS:
        sequence = {
          ...sequence,
          feedback1:
            feedback1 == "n"
              ? null
              : this.getStimulusByIdentifier(feedback1) || null,
        };
      case FeedbackType.TRUE_OR_FALSE:
        sequence = {
          ...sequence,
          feedback2:
            feedback2 == "n"
              ? null
              : this.getStimulusByIdentifier(feedback2) || null,
        };
        break;
      case FeedbackType.ALWAYS:
      case FeedbackType.NONE:
      case FeedbackType.CHOICE:
        break;
      default:
        throw new Error(`${feedbackType}은 유효한 Feedback Type이 아닙니다.`);
    }

    return sequence;
  }

  parseSequenceRows(rows: string[]): Sequence[] {
    let sequences: Sequence[] = [];

    for (let i = 0; i < rows.length; i++) {
      const sequenceRow: string = rows[i];
      const sequence = this.parseSequenceRow(sequenceRow);
      sequences.push(sequence);
    }

    return sequences;
  }

  parseAllSequences() {
    this.sequences.pre_sequence = this.parseSequenceRows(this.preSequenceRows);
    this.sequences.main_sequence = this.parseSequenceRows(
      this.mainSequenceRows
    );
    this.sequences.post_sequence = this.parseSequenceRows(
      this.postSequenceRows
    );
  }

  json() {
    return JSON.stringify(
      { stimulus: this.stimulus, sequences: this.sequences },
      null,
      " "
    );
  }
}

module.exports = Parser;
