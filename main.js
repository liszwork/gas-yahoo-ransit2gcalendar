function main() {
  const gmailSearchString = "label:me"; // 検索対象のラベル
  const mailInfo = getMailInfo(gmailSearchString);
  const sheet = SpreadsheetApp.getActive().getSheetByName("シート1");
  if (isExistMailInSheet(sheet, mailInfo["id"])) {
    // 前回メールと一致
    return;
  }
  if (!getIdentificationText(mailInfo["body"])) {
    // 対象外メール
    return;
  }

  // 実行対象のメール情報をシートに記録
  writeMailInSheet(sheet, mailInfo)

  // メール本文解析
  const date = getBodyDate(mailInfo["body"]);
  const places = getBodyPlaces(mailInfo["body"]);
  const timeSpan = getBodyOverallTimeSpan(mailInfo["body"]);
  const times = getBodyTimes(mailInfo["body"]);
  // 場所と出発時間
  const timeOfPlaces = createTimeOfPlaces(times, places);
  // カレンダー情報の作成
  const startDatetime = createDatetime(date, timeSpan[0]);
  const endDatetime = createDatetime(date, timeSpan[1]);
  const eventName = createEventName(timeOfPlaces, places, timeSpan[0]);
  // カレンダーへ登録
  setCalendar(eventName, startDatetime, endDatetime);
}

// 現在メールがシートの情報と一致？
// return: true=一致
function isExistMailInSheet(sheet, mailId) {
  // シートにメールが存在するか
  const val = sheet.getRange("A2").getValue();
  const result = ( val === mailId);
  log("isExistMailInSheet(): " + result);
  return result;
}

// シートにデータの書き込み
function writeMailInSheet(sheet, mailInfo){
  sheet.getRange("A2").setValue(mailInfo["id"]);   //メールID
  sheet.getRange("B2").setValue(mailInfo["date"]); //送信日時
  sheet.getRange("C2").setValue(mailInfo["body"]); //メール本文
}

// メール本文の取得
function getMailInfo(gmailSearchString) {
  // 検索文字列でヒットした一覧(スレッド)をサーチする
  const threads = GmailApp.search(gmailSearchString, 0, 1); //最新の一件
  const latestMail = GmailApp.getMessagesForThreads(threads)[0][0];
  // メール情報
  const mailInfo = {
    "body": latestMail.getPlainBody(),
    "id": latestMail.getId(),
    "date": latestMail.getDate()
  };
  return mailInfo;
}

// 対象のメール？
// return boolean
function getIdentificationText(body) {
  const result = getRegexExtraction(body, 'Yahoo!乗換案内', 'g');
  return result;
}

// 日付情報の取得
// return string
function getBodyDate(body) {
  const date = getRegexExtraction(body, '20[0-9]{2}年[01][0-9]月[0-3][0-9]日', '')[0];
  log("getBodyDate(): " + date);
  return date;
}

// 場所先頭にある記号をサーチして配列化
// return string[]
function getBodyPlaces(body) {
  // [■xxx, ■yyy, ■zzz]
  const places = getRegexExtraction(body, '■.+', 'g');
  log("getBodyPlaces(): " + places);
  return places;
}

// 時刻情報を取得
// return string
function getBodyOverallTimeSpan(body) {
  const targetText = getRegexExtraction(body, '[0-9]{2}:[0-9]{2} ⇒ [0-9]{2}:[0-9]{2}', 'g');
  const timeSpan = getRegexExtraction(targetText[0], '[0-9]{2}:[0-9]{2}', 'g');
  log("getBodyOverallTimeSpan(): " + timeSpan);
  return timeSpan;
}
// return string[]
function getBodyTimes(body) {
  const times = getRegexExtraction(body, '[0-9]{2}:[0-9]{2}～[0-9]{2}:[0-9]{2}', 'g');
  log("getBodyTimes(): " + times);
  return times;
}

// 渡された文字列を、引数Regex文字列でサーチした結果を返す
function getRegexExtraction(str, regexStr, flg) {
  const regex = new RegExp(regexStr, flg);
  const result = str.match(regex);
  return result;
}

// 場所と時間合わせ
function createTimeOfPlaces(times, places) {
  if ((places.length - 1) != times.length) {
    console.error("times, places num error");
  }
  var timeOfPlaces = {};
  // forの中でconstだと、それもリセット不可能らしい
  var debugMsg = "createTimeOfPlaces(): [";
  for (var i = 0; i < times.length; i++) {
    var time = times[i].split("～")[0];
    var place = deleteMark(places[i]);

    debugMsg += place + ":" + time + ",";
    timeOfPlaces[place] = time;
  }
  debugMsg += "]";
  log(debugMsg);
  timeOfPlaces[deleteMark(places[places.length - 1])] = "--";

  return timeOfPlaces;
}

// 日時の生成
function createDatetime(date, time) {
  const d = date.match(/\d+/g);
  const datetime = new Date(d[0] + "/" + d[1] + "/" + d[2] + " " + time);
  log("createDatetime(): " + datetime);
  return datetime;
}

// 不要な文字列を削除
function deleteMark(str) {
  const result = str.replace("■", "")
                    .replace("(削除したい情報:県など)", "");
  return result;
}

// イベント名称生成
function createEventName(timeOfPlaces, places, startTime) {
  const home = '家の住所';
  var isFirst = true;
  var eventName = "";
  var places = [];
  for (var p in timeOfPlaces) {
    if (isFirst) {
      eventName = (p === home ? "家" : p) + "→"
      isFirst = false;
    }
    else {
      places.push(p);
    }
  }
  if (places.length > 1) {
    const place = places[0];
    const time = timeOfPlaces[place];
    eventName += place + time + "発" + "→";
  }
  const lastPlace = places[places.length - 1];
  eventName += lastPlace;

  log("createEventName() " + eventName);

  return eventName;
}

// Googleカレンダーのデフォルトカレンダーへイベントセット
function setCalendar(eventName, startDatetime, endDatetime) {
  const msg = "Title: " + eventName + "\n"
            +  startDatetime + " ～ " + endDatetime;
  log("setCalendar(): " + msg);

  const calendar = CalendarApp.getDefaultCalendar();
  calendar.createEvent(eventName, startDatetime, endDatetime);
}

// ログ出力
function log(msg) {
  Logger.log(msg)
}