const SHEET_NAME = "prestataires";
const PHOTO_FOLDER_NAME = "UMH - Photos prestataires a valider";
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const HEADERS = [
  "nomCommercial",
  "numeroSiret",
  "numeroDeTel",
  "email",
  "typeDePrestation",
  "departementsCouverts",
  "siteWeb",
  "instagram",
  "facebook",
  "tiktok",
  "descriptionDesPrestationsProposees",
  "personnalisationUMH",
  "miseEnAvant",
  "photo",
  "dateInscription",
  "dateMAJ",
  "enLigne",
  "cgAcceptee",
  "photoDepotUrl"
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const sheet = getOrCreateSheet_();
    const photoDepotUrl = saveUploadedPhoto_(payload);

    const row = [
      value_(payload.nomCommercial),
      value_(payload.numeroSiret),
      value_(payload.numeroDeTel),
      value_(payload.email),
      stringifyArray_(payload.typeDePrestation),
      stringifyArray_(payload.departementsCouverts),
      value_(payload.siteWeb),
      value_(payload.instagram),
      value_(payload.facebook),
      value_(payload.tiktok),
      value_(payload.descriptionDesPrestationsProposees),
      value_(payload.personnalisationUMH),
      boolToString_(payload.miseEnAvant),
      value_(payload.photo),
      value_(payload.dateInscription),
      value_(payload.dateMAJ),
      boolToString_(payload.enLigne),
      boolToString_(payload.cgAcceptee),
      photoDepotUrl
    ];

    sheet.appendRow(row);
    return jsonResponse_({ ok: true });
  } catch (error) {
    return jsonResponse_({ ok: false, error: String(error) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  const sheet = getOrCreateSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return jsonResponse_({ typeDePrestationOptions: [], prestataires: [] });
  }

  const rows = values.slice(1);
  const prestataires = rows
    .map(rowToPrestataire_)
    .filter(function (p) { return p.nomCommercial; });

  const typeSet = {};
  prestataires.forEach(function (p) {
    var types = Array.isArray(p.typeDePrestation) ? p.typeDePrestation : [p.typeDePrestation];
    types.forEach(function (t) {
      if (t) typeSet[t] = true;
    });
  });

  const typeDePrestationOptions = Object.keys(typeSet).sort();
  return jsonResponse_({
    typeDePrestationOptions: typeDePrestationOptions,
    prestataires: prestataires
  });
}

function rowToPrestataire_(row) {
  const p = {};
  HEADERS.forEach(function (header, index) {
    p[header] = row[index];
  });

  p.typeDePrestation = parseArray_(p.typeDePrestation);
  if (p.typeDePrestation.length === 1) {
    p.typeDePrestation = p.typeDePrestation[0];
  }
  p.departementsCouverts = parseArray_(p.departementsCouverts);
  p.miseEnAvant = toBool_(p.miseEnAvant);
  p.enLigne = toBool_(p.enLigne);
  p.cgAcceptee = toBool_(p.cgAcceptee);
  return p;
}

function saveUploadedPhoto_(payload) {
  const upload = payload && payload.photoUpload;
  if (!upload || !upload.data) {
    return "";
  }

  const mimeType = value_(upload.mimeType);
  if (ACCEPTED_PHOTO_MIME_TYPES.indexOf(mimeType) === -1) {
    throw new Error("Format photo refuse. Formats acceptes: JPG, PNG, WebP.");
  }

  const size = Number(upload.size || 0);
  if (!size || size > MAX_PHOTO_SIZE_BYTES) {
    throw new Error("La photo ne doit pas depasser 5 Mo.");
  }

  const bytes = Utilities.base64Decode(value_(upload.data));
  if (bytes.length > MAX_PHOTO_SIZE_BYTES) {
    throw new Error("La photo ne doit pas depasser 5 Mo.");
  }

  const folder = getOrCreatePhotoFolder_();
  const extension = extensionFromMimeType_(mimeType);
  const handle = instagramHandle_(payload.instagram);
  const baseName = handle || slugify_(payload.nomCommercial) || ("prestataire-" + Date.now());
  const fileName = baseName + extension;
  const blob = Utilities.newBlob(bytes, mimeType, fileName);
  const file = folder.createFile(blob);

  return file.getUrl();
}

function getOrCreatePhotoFolder_() {
  const folders = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(PHOTO_FOLDER_NAME);
}

function extensionFromMimeType_(mimeType) {
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  return ".jpg";
}

function instagramHandle_(value) {
  let raw = value_(value);
  if (!raw) return "";
  raw = raw.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "");
  raw = raw.replace(/^@/, "");
  return raw.split(/[\/?#]/)[0].trim().toLowerCase();
}

function slugify_(value) {
  return value_(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const needsHeader = firstRow.join("").trim() === "";
  if (needsHeader) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  } else {
    ensureMissingHeaders_(sheet);
  }
  return sheet;
}

function ensureMissingHeaders_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const existingHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function (header) {
    return value_(header);
  });

  const missingHeaders = HEADERS.filter(function (header) {
    return existingHeaders.indexOf(header) === -1;
  });

  if (missingHeaders.length) {
    sheet.getRange(1, existingHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
  }
}

function parseArray_(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  const raw = String(value).trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(function (v) { return String(v).trim(); }).filter(Boolean);
    }
  } catch (err) {}
  return raw.split(",").map(function (v) { return v.trim(); }).filter(Boolean);
}

function stringifyArray_(value) {
  const arr = Array.isArray(value) ? value : [value];
  return JSON.stringify(arr.map(function (v) { return value_(v); }).filter(Boolean));
}

function toBool_(value) {
  const v = String(value).toLowerCase();
  return v === "true" || v === "1" || v === "oui";
}

function boolToString_(value) {
  return value ? "true" : "false";
}

function value_(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
