let database, page, curso, disciplina, conteudo, aula;

const DB_STORE = "aula";

function openDatabase(name, version) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(name, version);

        request.onerror = event => reject(new Error(event.target.error?.message));
        request.onsuccess = event => resolve(event.target.result);
        request.onupgradeneeded = event => {
            const db = event.target.result;
            const store = db.createObjectStore(DB_STORE, { keyPath: "id", autoIncrement: true });
            store.createIndex('materia', ['curso', 'disciplina', 'conteudo', 'aula']);
            store.createIndex("curso", "curso");
            store.createIndex("disciplina", "disciplina");
            store.createIndex("conteudo", "conteudo");
            store.createIndex("aula", "aula");
            store.createIndex("slide", "slide");
            store.createIndex("resumo", "resumo");
            store.createIndex("video", "video");
            store.createIndex("slideURL", "slideURL");
            store.createIndex("resumoURL", "resumoURL");
            store.createIndex("videoURL", "videoURL");
        };
    });
}

async function loadDatabase() {
    page = document.querySelector('iframe').contentDocument;
    curso = extractText(/Voltar para tela do curso: (.+?)"/);
    disciplina = extractText(/Disciplina selecionada: (.+?)"/);
    conteudo = extractText(/Conteúdo selecionado: (.+?)"/);
    aula = sanitizeText(page.querySelector('h1').innerText.replace(/ \(código.*/, ''));

    if (!curso || !disciplina || !conteudo || !aula) {
        console.error("Extraction failed", { curso, disciplina, conteudo, aula });
        return null;
    }

    return openDatabase("grancursos", 1);
}

function extractText(regex) {
    const match = page.body.innerHTML.match(regex);
    return match ? sanitizeText(match[1]) : null;
}

function sanitizeText(text) {
    return text.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9]+/g, '-').trim();
}

function withObjectStore(mode, callback) {
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([DB_STORE], mode);
        const store = transaction.objectStore(DB_STORE);

        const request = callback(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function queryDB(key, value) {
    console.log("Querying", key, value);
    return withObjectStore("readonly", store => {
        const index = store.index(key);
        return index.getAll(value);
    });
}

function addToDB(data) {
    console.log("Adding", data);
    return withObjectStore("readwrite", store => store.add(data));
}

function putToDB(data) { // parei aqui: algum bug que quando atualiza o registro, parece que encerra o loop, da linha 115, sem percorrer os demais arquivos
    if (!data.id) throw new Error("{id} is required");

    console.log("Updating", data.id, data);
    return withObjectStore("readwrite", store =>
        store.get(data.id).onsuccess = event => {
            if (!event.target.result) throw new Error("No data with id", data.id);
            return store.put({ ...event.target.result, ...data });
        }
    );
}

async function updateDatabase(aula, tipo, filename, url) {
    const [arquivo] = await queryDB(tipo, filename);
    if (!arquivo) await downloadFile(url, filename);

    const [result] = await queryDB("materia", [curso, disciplina, conteudo, aula]);
    if (!result) await addToDB({ curso, disciplina, conteudo, aula, [tipo]: filename, [`${tipo}URL`]: url });
    else if (result[tipo] === filename) console.log(`Already downloaded: ${filename}`);
    else await putToDB({ id: result.id, [tipo]: filename, [`${tipo}URL`]: url });
}

async function downloadFile(url, filename) {
    console.log("Downloading", filename);

    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(blobUrl);
}

async function baixarMaterial(label, tipo = "slide") {
    for (const el of page.querySelectorAll("#lista-aulas > li")) {
        const material = el.querySelector(`a[aria-label="${label}"]`) ?? el.querySelector(`a[href^="/aluno/espaco/${label}"]`);
        const aula = el.querySelector('span').innerText.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9]+/g, '-');

        if (!material?.href || !aula) continue;

        const urlRes = await fetch(material.href);
        const filename = urlRes.url.split(/\/|\?/).at(-2);

        if (!filename) { console.error("Filename extraction error:", urlRes.url); continue; }

        await updateDatabase(aula, tipo, filename, urlRes.url);
    }
}

async function baixarVideo(url) {
    const filename = url.match(/[^\/]+\.mp4/)[0];
    await updateDatabase(aula, "video", filename, url);
}

async function salvarProgresso(filename, contentType) {
    console.log("Saving progress");
}

chrome.runtime.onMessage.addListener(
    async (request, sender, sendResponse) => {
        if (!database) database = await loadDatabase();

        if (request.fn == 'salvarProgresso') salvarProgresso('grancursos.csv', { 'text/csv': ['.csv'] })
        else if (request.fn == 'baixarVideo') await baixarVideo(page.querySelector("video").src.trim())
        else if (request.fn == 'baixarSlides') {
            await baixarMaterial("Baixar slide da aula")
            await baixarMaterial("download-apostila")
        } else if (request.fn == 'baixarResumos') {
            await baixarMaterial("Material em PDF", "resumo")
            await baixarMaterial("Baixar aula degravada", "resumo")
            await baixarMaterial("download-resumo", "resumo")
        }
        sendResponse({ success: "TRUE" });
        return true;
    });