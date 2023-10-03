const settings = {
    dev: false,
    textColor: '#ffffff',
    background: '#151515',
};

const fileManager = FileManager.local();
const cachePath = fileManager.joinPath(fileManager.documentsDirectory(), 'koleo-widget-cache.json');

const brandNames = { '6': 'ARRIVARP', '51': 'CD', '2': 'EIC', '29': 'EIP', '28': 'IC', '57': 'KOLEO BUS', '47': 'LEO', '52': 'LEO_PLUS', '40': 'MultiPlaza', '59': 'Kulturzug', '20': 'PRS', '58': 'KDR', '38': 'SKPL', '54': 'RKW', '45': 'KDP', '53': 'UZ', '56': 'SLONECZNY', '33': 'KML', '4': 'IR', '10': 'KD', '14': 'KM', '11': 'KS', '12': 'KW', '13': 'LKA', '46': 'LP', '43': 'LS', '18': 'MR', '49': 'PKS', '5': 'RE', '3': 'REG', '27': 'SKM', '9': 'SKMT', '48': 'sR', '1': 'TLK', '8': 'WKD' };
const brandColors = { '6': '#018091', '51': '#FD6608', '2': '#6C727A', '29': '#102C76', '28': '#EF7F0B', '57': '#0075E2', '47': '#FD6608', '52': '#FD6608', '40': '#018091', '59': '#2A2A28', '20': '#E50000', '58': '#2A2A28', '38': '#0C5DC5', '54': '#ADB3B3', '45': '#2A2A28', '53': '#adb3b3', '56': '#00A34F', '33': '#FBBF00', '4': '#E50000', '10': '#2A2A28', '14': '#00A34F', '11': '#009EDC', '12': '#9D0A0E', '13': '#ADB3B3', '46': '#ADB3B3', '43': '#ADB3B3', '18': '#E50000', '49': '#adb3b3', '5': '#ADB3B3', '3': '#E50000', '27': '#FF1100', '9': '#003955', '48': '#E50000', '1': '#F86505', '8': '#0545CB' }

function buildURLSearchParams(parameters) {
    let qs = "";
    for (let key in parameters) {
        let value = parameters[key];
        qs += encodeURIComponent(key) + "=" + encodeURIComponent(value) + "&";
    }
    return qs;
}

async function getStations() {
    const request = new Request(`https://koleo.pl/api/v2/main/stations`);
    request.headers = {
        'X-KOLEO-Version': '1',
        'X-KOLEO-Client': 'iOS-310',
    };
    return await request.loadJSON();
}

async function getConnections(origin, destination) {
    const params = buildURLSearchParams({
        'query[start_station]': origin,
        'query[end_station]': destination,
        'query[date]': new Date().toISOString(),
    });
    const request = new Request(`https://koleo.pl/api/v2/main/connections?${params}`);
    request.headers = {
        'X-KOLEO-Version': '1',
        'X-KOLEO-Client': 'iOS-310',
    };
    return (await request.loadJSON()).connections;
}

async function askForStation(alertTitle, stations) {
    const textAlert = new Alert();
    textAlert.title = alertTitle;
    textAlert.addTextField('Station name');
    textAlert.addAction('Search');

    await textAlert.present();
    const text = textAlert.textFieldValue(0);

    const filteredStations = stations.filter(station => station.name.toLowerCase().includes(text.toLowerCase())).slice(0, 5);
    const alert = new Alert();
    alert.title = alertTitle;

    filteredStations.forEach((station) => {
        alert.addAction(station.name);
    });

    alert.addCancelAction('Cancel');
    const result = await alert.present();

    if (result === -1) {
        return null;
    } else {
        return filteredStations[result];
    }
}

async function configure() {
    const stations = await getStations();

    const departureStation = await askForStation('Choose departure station', stations);

    if (departureStation === null) {
        return;
    }

    const arrivalStation = await askForStation('Choose arrival station', stations);

    if (arrivalStation === null) {
        return;
    }

    fileManager.writeString(cachePath, JSON.stringify({ departureStation, arrivalStation }));
}

function formatTime(date) {
    return date.toTimeString().slice(0, 5);
}

function addArrow(element, color) {
    let arrowContainer = element.addStack();

    let symbol = SFSymbol.named("chevron.right");
    symbol.applyMediumWeight();
    symbol.applyFont(Font.systemFont(14));

    let image = arrowContainer.addImage(symbol.image);
    image.tintColor = color;
    image.resizable = false;
    image.centerAlignImage();
    arrowContainer.size = new Size(16, 16);
    arrowContainer.setPadding(2, 0, 0, 0);
    arrowContainer.centerAlignContent();

    return arrowContainer;
}

async function addConnections(app, departureStation, arrivalStation) {
    const connections = (await getConnections(departureStation.name_slug, arrivalStation.name_slug)).slice(0, 3);

    let connectionHeader = app.addText(`${departureStation.name} - ${arrivalStation.name}`);
    connectionHeader.font = Font.systemFont(16);
    app.addSpacer(8);

    connections.forEach((connection) => {
        let container = app.addStack();
        container.layoutVertically();

        let hours = container.addStack();

        for (let i = 0; i < connection.trains.length; i++) {
            let train = hours.addStack();
            train.backgroundColor = new Color(brandColors[connection.trains[i].brand_id]);
            train.cornerRadius = 4;
            train.setPadding(0, 4, 0, 4);
            train.addText(brandNames[connection.trains[i].brand_id]);

            hours.addSpacer(4);

            let h1 = hours.addText(formatTime(new Date(connection.trains[i].departure)));
            h1.font = Font.systemFont(16);
            addArrow(hours, new Color("#1a7eee"));
            let h2 = hours.addText(formatTime(new Date(connection.trains[i].arrival)));
            h2.font = Font.systemFont(16);

            if (i !== connection.trains.length - 1) {
                hours.addSpacer(5);
                addArrow(hours, new Color("#555555"));
                hours.addSpacer(5);
            }
        }

        container.addSpacer(2);

        let details = container.addStack();
        let t1 = details.addText(connection.changes === 0 ? "direct train" : connection.changes === 1 ? "1 change" : `${connection.changes} changes`);
        t1.font = Font.systemFont(13);
        t1.textOpacity = 0.6;
        details.addSpacer();
        let t2 = details.addText(`${connection.travel_time} min`);
        t2.font = Font.systemFont(13);
        t2.textOpacity = 0.6;

        container.addSpacer(2);
        let line = container.addStack();
        line.backgroundColor = new Color("#ffffff", 0.2);
        line.size = new Size(310, 1);
        container.addSpacer(8);
    });
}

async function main() {
    const cache = JSON.parse(fileManager.readString(cachePath));

    const app = new ListWidget();
    app.backgroundColor = new Color(settings.background);

    app.addSpacer(4);
    await addConnections(app, cache.departureStation, cache.arrivalStation);
    await addConnections(app, cache.arrivalStation, cache.departureStation);

    !settings.dev || config.runsInWidget ? Script.setWidget(app) : await app.presentLarge();
    Script.complete();
}

if (!settings.dev && config.runsInApp) {
    await configure();
} else {
    await main();
}
