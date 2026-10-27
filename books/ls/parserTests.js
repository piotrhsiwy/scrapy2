import { datestringToISO } from "./parser.js";
function test(input, expectedOutput){
    let output;
    try{
        output = datestringToISO(input);
        if(expectedOutput === output){
            return `Success. case: ${input} should be ${expectedOutput}, but is ${output}`
        } else{
            return `Failure. case: ${input} should be ${expectedOutput}, but is ${output}`
        }
    } catch(error){
        return `Error thrown. case: ${input} should be ${expectedOutput}, but is ${output}`;
    }
}

function parserTest(cases){
    let failed = 0;
    for(let i = 0; i < cases.length; i++){
        const testCase = cases[i];
        const retStr = test(testCase.in, testCase.out);
        if( retStr.includes('Failure') || retStr.includes('Error')){
            console.log(retStr);
            failed++;
        }
    }
    const completed = cases.length - failed;
    console.log(`${completed}/${cases.length} tests completed successfully.`)
}

const testcases = [
    {
        in: '25/10 • 00:00',
        out: '2026-10-24T22:00:00.000Z'
    },
    {
        in: '25/10 • 10:00',
        out: '2026-10-25T08:00:00.000Z'
    },
    {
        in: undefined,
        out: undefined
    },
    {
        in: 'BO3: NukeR: 20/24',
        out: undefined
    },
    {
        in: '',
        out: undefined
    }
]

parserTest(testcases);