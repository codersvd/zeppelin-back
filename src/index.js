import express from 'express';
import fetch from "node-fetch";
import pgPromise from 'pg-promise';

const pgp = pgPromise({});
const app = express()
const port = 5010

const db = pgp("postgres://postgres:postgres@127.0.0.1:5432/postgres");
const key = ""; // use your own api key
const apiUrl = "https://api.apilayer.com/exchangerates_data";
const options = {
    method: 'GET',
    redirect: 'follow',
    headers: {
        "apikey": key
    }
};

(async () => {
    const sql = `
        DROP TABLE IF EXISTS rates;
        CREATE TABLE rates
        (
            id            SERIAL PRIMARY KEY,
            code          char(3),
            rate          float(24),
            base_currency char(3),
            date          char(10)
        );
    `;
    //await db.any(sql)
})();

app.get('/getYearRates', async (req, res) => {
    const columnSet = new pgp.helpers.ColumnSet(['code', 'rate', 'date', 'base_currency'], {table: 'rates'});
    const values = await getRatesYearFromFetch();
    if (values.length > 0) {
        const query = () => pgp.helpers.insert(values, columnSet);
        await db.none(query);
    }

    res.send("hello world");
})

app.get('/getDayRates', async (req, res) => {
    const columnSet = new pgp.helpers.ColumnSet(['code', 'rate', 'date'], {table: 'rates'});
    const values = await getRatesDayFromFetch();
    const isExistRate = await db.any("SELECT COUNT(*) as length FROM rates WHERE date=$1", [values[0].date]);

    if (values.length > 0 && +isExistRate[0].length === 0) {
        const query = () => pgp.helpers.insert(values, columnSet);
        await db.none(query);
    }

    res.send("hello world");
})

app.get('/convert', async (req, res) => {
    const today = new Date();
    const todayDate = today.getFullYear() + '-' + (String(today.getMonth() + 1).padStart(2, '0')) + '-' + today.getDate();
    const priceEUR = 550;
    const priceUSD = 240;
    const priceRUB = 5000;

    const resultEUR = await db.any(
        "SELECT date, code, rate, ($6) as price, base_currency, CAST(($6/rate) AS NUMERIC(14,4)) as converted FROM rates as eur WHERE code=$2 AND date=$5 AND base_currency=$1 UNION " +
        "SELECT date, code, rate, ($7) as price, base_currency, CAST(($7/rate) AS NUMERIC(14,4)) as converted FROM rates as usd WHERE code=$3 AND date=$5 AND base_currency=$1 UNION " +
        "SELECT date, code, rate, ($8) as price, base_currency, CAST(($8/rate) AS NUMERIC(14,4)) as converted FROM rates as rub WHERE code=$4 AND date=$5 AND base_currency=$1",
        [
            "EUR", "GBP", "USD", 'RUB', todayDate, priceEUR, priceUSD, priceRUB
        ]);

    const resultUSD = await db.any(
        "SELECT date, code, rate, ($6) as price, base_currency, CAST(($6/rate) AS NUMERIC(14,4)) as converted FROM rates as eur WHERE code=$2 AND date=$5 AND base_currency=$1 UNION " +
        "SELECT date, code, rate, ($7) as price, base_currency, CAST(($7/rate) AS NUMERIC(14,4)) as converted FROM rates as usd WHERE code=$3 AND date=$5 AND base_currency=$1 UNION " +
        "SELECT date, code, rate, ($8) as price, base_currency, CAST(($8/rate) AS NUMERIC(14,4)) as converted FROM rates as rub WHERE code=$4 AND date=$5 AND base_currency=$1",
        [
            "USD", "GBP", "EUR", 'RUB', todayDate, priceEUR, priceUSD, priceRUB
        ]);
    console.log(resultEUR, resultUSD);
    res.send("hello world");
})

async function getRatesYearFromFetch() {
    const RatesArray = [];
    const symbols = getSymbols();
    try {
        const today = new Date();
        const todayDate = today.getFullYear() + '-' + (String(today.getMonth() + 1).padStart(2, '0')) + '-' + today.getDate();
        for (let i = 0; i < symbols.length; i++) {
            const url = apiUrl + '/timeseries?base=' + symbols[i] + '&start_date=2022-01-01&end_date=' + todayDate;

            const result = await fetch(url, options);
            const ratesData = await result.json();

            const base_currency = ratesData.base;
            for (let date in ratesData.rates) {
                for (let code in ratesData.rates[date]) {
                    const rate = ratesData.rates[date][code];
                    RatesArray.push({code, rate, date, base_currency})
                }
            }
        }
    } catch (err) {
        console.log(err);
    }

    return RatesArray;
}

async function getRatesDayFromFetch() {
    const RatesArray = [];
    const symbols = getSymbols();
    try {
        const today = new Date();
        const todayDate = today.getFullYear() + '-' + (String(today.getMonth() + 1).padStart(2, '0')) + '-' + today.getDate();

        for (let i = 0; i < symbols.length; i++) {
            const url = apiUrl + '/' + todayDate + '?base='+symbols[i];

            const result = await fetch(url, options);
            const ratesData = await result.json();

            const date = ratesData.date;
            const base_currency = ratesData.base;
            for (let code in ratesData.rates) {
                const rate = ratesData.rates[code];
                RatesArray.push({code, rate, date, base_currency})
            }
        }
    } catch (err) {
        console.log(err);
    }

    return RatesArray;
}

function getSymbols() {
    return ["USD", "EUR"];
}

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
