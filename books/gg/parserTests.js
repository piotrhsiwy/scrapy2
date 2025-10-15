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
        if( retStr.includes('Failure')){
            console.log(retStr);
            failed++;
        }
    }
    const completed = cases.length - failed;
    console.log(`${completed}/${cases.length} tests completed successfully.`)
}

const testcases = [
    {
        in: '13:00Today',
        out: '2025-10-15T11:00:00.000Z'
    },
    {
        in: '00:00Tomorrow',
        out: '2025-10-15T22:00:00.000Z'
    },
    {
        in: '23:00Tomorrow',
        out: '2025-10-16T21:00:00.000Z'
    },
    {
        in: '04:00Oct 18',
        out: '2025-10-18T02:00:00.000Z'
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