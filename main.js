const fs = require("fs");
const Parser = require("./parser.js");

try {
  const test1 = fs.readFileSync("./in/test1.txt", "utf8").toString();
  const test2 = fs.readFileSync("./in/test2.txt", "utf8").toString();

  const parser1 = new Parser(test1);
  const parser2 = new Parser(test2);

  fs.writeFileSync("./out/result1.json", parser1.execute().json());
  fs.writeFileSync("./out/result2.json", parser2.execute().json());
} catch (e) {
  console.log(e.stack);
}
