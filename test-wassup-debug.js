const express = require('express');
const cors = require('cors');

console.log('🔍 DEBUGGING WASSUP ISSUE');

/**
 * Check if input is purely conversational (EXACT from Railway deployment)
 */
function isConversationalInput(input) {
  const conversationalPatterns = [
    /^(hi|hello|hey)[\s!]*$/i,
    /^how are you[\s?]*$/i,
    /^what's up[\s?]*$/i,
    /^whats up[\s?]*$/i,
    /^wassup[\s?]*$/i,
    /^good (morning|afternoon|evening)[\s!]*$/i,
    /^thank you[\s!]*$/i,
    /^thanks[\s!]*$/i,
    /^(im great|not much|good|fine).*$/i,
    /^(lol|haha|awesome|nice|wow)[\s!]*$/i,
    /^(yes|no|sure|maybe|alright)[\s!]*$/i,
    /^(ok|okay|cool|got it|gotcha)[\s!]*$/i,
    /^(i'm good|i'm fine|i'm great|i'm okay).*$/i,
    /^(doing good|doing well|doing fine|doing great|doing awesome).*$/i,
    /^not much[\s,].*$/i,
    /^just.*$/i,
    /^nothing much[\s,].*$/i
  ];
  
  return conversationalPatterns.some(pattern => pattern.test(input.trim()));
}

// Test various inputs to see what's working
const testInputs = [
  "wassup?",
  "wassup",
  "what's up?",
  "whats up",
  "hello",
  "hi",
  "warn @user for spam",
  "ban someone",
  "hey what's going on"
];

console.log('\n🧪 Testing isConversationalInput function:');
console.log('='.repeat(50));

testInputs.forEach(input => {
  const result = isConversationalInput(input);
  console.log(`"${input}" → ${result ? '✅ CONVERSATIONAL' : '❌ NOT CONVERSATIONAL'}`);
});

// Test the exact patterns used
console.log('\n🔍 Testing wassup patterns specifically:');
console.log('='.repeat(50));

const wassupPatterns = [
  /^wassup[\s?]*$/i,
  /^what's up[\s?]*$/i,
  /^whats up[\s?]*$/i
];

const wassupInputs = ["wassup?", "wassup", "what's up?", "whats up"];

wassupInputs.forEach(input => {
  console.log(`\nTesting: "${input}"`);
  wassupPatterns.forEach((pattern, index) => {
    const matches = pattern.test(input.trim());
    console.log(`  Pattern ${index + 1}: ${pattern} → ${matches ? '✅ MATCH' : '❌ NO MATCH'}`);
  });
});

console.log('\n🎯 Direct test of the exact message that\'s failing:');
console.log('='.repeat(50));

// Simulate the exact processing that happens in the server
const testMessage = "@bot wassup?";
const botMentionRegex = /<@\!?(\d+)>/;
const cleanMessage = testMessage.replace(botMentionRegex, '').trim();

console.log(`Original message: "${testMessage}"`);
console.log(`After bot mention removal: "${cleanMessage}"`);
console.log(`isConversationalInput result: ${isConversationalInput(cleanMessage)}`);

// Test what the AI would see
console.log('\n🤖 What the AI receives:');
console.log('='.repeat(50));
console.log(`Clean message passed to AI: "${cleanMessage}"`);
console.log(`Should be caught by conversational check: ${isConversationalInput(cleanMessage)}`); 