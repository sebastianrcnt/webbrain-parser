"use strict";
var StimulusType;
(function (StimulusType) {
    StimulusType["IMAGE"] = "image";
    StimulusType["TEXT"] = "text";
    StimulusType["TEXT_FILE"] = "text_file";
    StimulusType["AUDIO"] = "audio";
    StimulusType["VIDEO"] = "video";
    StimulusType["INSTRUCTION"] = "instruction";
    StimulusType["RESULT"] = "result";
})(StimulusType || (StimulusType = {}));
var FeedbackType;
(function (FeedbackType) {
    FeedbackType["NONE"] = "n";
    FeedbackType["TRUE_OR_FALSE"] = "tf";
    FeedbackType["ALWAYS"] = "a";
    FeedbackType["CHOICE"] = "c";
})(FeedbackType || (FeedbackType = {}));
class Parser {
    /* Procedure
    ** Objective
    1. this.instructions = ["Task WM Test Experiment", "...", ..., "[EndPostSeq]"]
    2. this.sections = {stimulus, sequences: {pre_sequence: [], main_sequence: [], post_sequence: []}}
    3. this.stimulus = {"I1": {...}, "I2": {...}}
    4. this.sequence = {"pre_sequence": [], "main_sequence": [], post_sequence: []}
    
    ** Methods in Order
    1. constructor(rawInstructions)
      - convert and trim rawInstructions to this.instructions
    2. splitSection()
      - splits instructions into this.sections
      - stimulus section instructions: this.sections.stimulus
      - sequence section instructions: this.sections.sequences(.pre_sequeence, main_sequence, post_sequence)
    3. parseStimulus()
      - parses stimulus instructions to this.stimulus
    4. parseSequence()
      - parses pre_sequence, main_sequence, post_sequence instructions to this.sequence
    */
    /**
     * Converts rawInstructios into array of instruction rows, with every instruction row is trimmed(whitespace removed)
     * @param  {string} rawInstructions raw text of instruction
     */
    constructor(rawInstructions) {
        this.instructions = rawInstructions
            .split("\n")
            .map((instruction) => instruction.trim());
        this.stimulusInstructions = [];
        this.preSequenceInstructions = [];
        this.mainSequenceInstructions = [];
        this.postSequenceInstructions = [];
        this.stimulus = {};
        this.sequences = {};
    }
    /**
     * Extracts Instruction Rows that corresponds to the given section keyword.
     * @param {string} keyword Section Name(ex: PostSeq)
     * @param {Instruction[]} instructions Full Instructions
     */
    static extractInstructionsFromSection(keyword, instructions) {
        let sectionStartIndex = null;
        let sectionEndIndex = null;
        for (let index = 0; index < instructions.length; index++) {
            const instruction = instructions[index];
            const isSectionStartInstruction = instruction == `[${keyword}]`;
            const isSectionEndInstruction = instruction == `[End${keyword}]`;
            if (isSectionStartInstruction) {
                sectionStartIndex = index;
            }
            else if (isSectionEndInstruction) {
                sectionEndIndex = index;
                break;
            }
        }
        // Instructions 섹션 파싱에 실패했을 경우
        if (sectionStartIndex === null || sectionEndIndex === null) {
            throw new Error(`해당 키워드(${keyword})에 대한 섹션을 추출하지 못했습니다`);
        }
        else if (sectionStartIndex === null && sectionEndIndex === null) {
            throw new Error(`해당 키워드(${keyword})에 대하여 섹션 시작지점은 찾았으나 섹션 종료지점을 찾지 못했습니다.`);
        }
        else if (sectionStartIndex === null && sectionEndIndex === null) {
            throw new Error(`해당 키워드(${keyword})에 대하여 섹션 종료지점은 찾았으나 섹션 시작지점을 찾지 못했습니다.`);
        }
        else {
            return instructions.slice(sectionStartIndex + 1, sectionEndIndex);
        }
    }
    /**
     * Splits text with given character, ignoring content inside two pair of characters
     * @param  {string} text text to be splitted
     * @param  {string} splitChar character to split with
     * @param  {string} pairChar  character of a pair of brackets whose inner content will be escaped
     * @returns {string[]} splittedArray
     */
    static splitWithEscapedCharacter(text, splitChar, pairChar) {
        text = text + splitChar; // parsing last
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
                    }
                    else {
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
    /**
     * @param  {string} stimulusIdentifier identifier of a stimulus(ex: 'I1')
     * @returns {object} stimulus
     */
    getStimulusByIdentifier(stimulusIdentifier) {
        const found = this.stimulus[stimulusIdentifier];
        if (found) {
            return found;
        }
        else {
            throw new Error(`Stimulus Identifier ${stimulusIdentifier} is not valid`);
        }
    }
    /**
     * Splits instructions into this.sections
     */
    splitSection() {
        this.stimulusInstructions = Parser.extractInstructionsFromSection("Descriptions", this.instructions);
        this.preSequenceInstructions = Parser.extractInstructionsFromSection("PreSeq", this.instructions);
        this.mainSequenceInstructions = Parser.extractInstructionsFromSection("MainSeq", this.instructions);
        this.postSequenceInstructions = Parser.extractInstructionsFromSection("PostSeq", this.instructions);
    }
    /**
     * Parses stimulus instructions to this.stimulus
     */
    parseStimulus() {
        /*
        STIMULUS SYNTAX
    
        # stimulus description : <type> <identifier> ...
          - <type> := image | text | video | audio | instruction | result
        # image description : image <identifier> <file_path> <button>
          - <button> := true | false
        # text description : text <identifier> <content> <font_size> <font_color>
          - if font_size or font_color is n(none), the default setting will be used.
          - <content> must be contained in " and "
          - the unit for font_size is px
        # text_file description : text_file <identifier> <file_path> <font_size> <font_color>
          - if font_size or font_color is n(none), the default setting will be used
        # audio description : audio <identifier> <file_path>
        */
        for (let index = 0; index < this.stimulusInstructions.length; index++) {
            const currentStimulusInstruction = this.stimulusInstructions[index];
            const splittedStimulusInstruction = Parser.splitWithEscapedCharacter(currentStimulusInstruction, " ", '"');
            // Extract stimulus
            const [stimulusType, identifier] = splittedStimulusInstruction;
            const left = splittedStimulusInstruction.slice(2);
            // Construct Stimulus Object according to Stimulus Type
            let stimulus = {
                stimulusType: stimulusType,
            };
            switch (stimulusType) {
                case StimulusType.IMAGE:
                    {
                        let [filePath, // ex) 'img/3.png'
                        button,] = left;
                        stimulus = { stimulusType, filePath, button: !!button };
                    }
                    break;
                case StimulusType.TEXT:
                    {
                        let [content, fontSize, fontColor] = left;
                        stimulus = {
                            stimulusType,
                            content,
                            fontSize: fontSize === "n" ? null : parseInt(fontSize),
                            fontColor: fontColor === "n" ? null : fontColor,
                        };
                    }
                    break;
                case StimulusType.TEXT_FILE:
                    {
                        let [filePath, fontSize, fontColor] = left;
                        stimulus = {
                            stimulusType,
                            filePath,
                            fontSize: fontSize === "n" ? null : parseInt(fontSize),
                            fontColor: fontColor === "n" ? null : fontColor,
                        };
                    }
                    break;
                case StimulusType.AUDIO:
                case StimulusType.VIDEO:
                    {
                        let [filePath] = splittedStimulusInstruction;
                        stimulus = { stimulusType, filePath };
                    }
                    break;
                default:
                    throw new Error(`${stimulusType}은 유효한 자극 유형이 아닙니다`);
            }
            this.stimulus[identifier] = stimulus;
        }
    }
    /**
     * Parses pre_sequence, main_sequence, post_sequence instructions to this.sequence
     */
    parseSequence() {
        /*
        SEQUENCE SYNTAX
    
        # sequence description: <onSetTime> <identifier> <stimDur> <choices> <choiceDur> <answer> <choiceOnsetRelativeToSim> <reactionTime> <feed_back_type> <feed_back_duration> <feed_back_1> <feed_back_2> <test>
        - <onSetTime> := <number>
        - <stimDur> := <number> | inf
        - <choiceDur> := <number> | inf
        - <choices> := n | <identifier>,<identifier>,...,<identifier>
        - <answer> := n | <index_of_the_choice>
        - <choiceOnsetRelativeToSim> := <number>
        - <reactionTime> := <number>
        - <feed_back_type> := n | tf | a | c
        - <feed_back_duration> := n | <number>
        - <feed_back_1> := n | <identifier>
        - <feed_back_2> := n | <identifier>
        - <test> := y | n
        */
        // for each sequence sections(pre_sequence, main_sequence, post_sequence)
        const SequenceInstructions = {
            pre_sequence: this.preSequenceInstructions,
            main_sequence: this.mainSequenceInstructions,
            post_sequence: this.postSequenceInstructions,
        };
        for (let sequenceName in SequenceInstructions) {
            const instructions = SequenceInstructions[sequenceName];
            let buffer = [];
            for (let i = 0; i < instructions.length; i++) {
                const instruction = instructions[i];
                const splittedInstruction = instruction.split(" ");
                // Extract Sequence
                const [onSetTime, // 0: number(ms)
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
                test,] = splittedInstruction;
                // Process & pack stimulus
                let sequence = {
                    onSetTime: +onSetTime,
                    identifier,
                    stimulusDuration: stimulusDuration === "inf" || stimulusDuration === "n"
                        ? stimulusDuration
                        : +stimulusDuration,
                    choices: choices === "n"
                        ? choices
                        : choices
                            .split(",") // ['s1', 's2']
                            .map((identifier) => {
                            return this.getStimulusByIdentifier(identifier);
                        }),
                    // [{type: 'image', body: 'img/2.png', font_color: null, font_size: null}, {...}]
                    choiceDuration: choiceDuration === "inf" || choiceDuration === "n"
                        ? choiceDuration
                        : +choiceDuration,
                    answer,
                    choiceOnsetRelativeToSim: choiceOnsetRelativeToSim == "inf" || choiceOnsetRelativeToSim == "n"
                        ? choiceOnsetRelativeToSim
                        : +choiceOnsetRelativeToSim,
                    reactionTime: reactionTime == "n" || reactionTime == "inf"
                        ? reactionTime
                        : +reactionTime,
                    feedbackType: feedbackType,
                    feedbackDuration: feedbackDuration == "n" || feedbackDuration == "inf"
                        ? feedbackDuration
                        : +feedbackDuration,
                    test: test,
                };
                switch (feedbackType) {
                    case FeedbackType.ALWAYS:
                        sequence = Object.assign(Object.assign({}, sequence), { feedback1 });
                    case FeedbackType.TRUE_OR_FALSE:
                        sequence = Object.assign(Object.assign({}, sequence), { feedback2 });
                        break;
                    case FeedbackType.ALWAYS:
                    case FeedbackType.NONE:
                    case FeedbackType.CHOICE:
                        break;
                    default:
                        throw new Error(`${feedbackType}은 유효한 Feedback Type이 아닙니다.`);
                }
                buffer.push(sequence);
            }
            this.sequences[sequenceName] = buffer;
        }
    }
    execute() {
        this.splitSection();
        this.parseStimulus();
        this.parseSequence();
        return this;
    }
    json() {
        return JSON.stringify({ stimulus: this.stimulus, sequences: this.sequences }, null, " ");
    }
}
module.exports = Parser;
