from openai import OpenAI

OPENAI_API_KEY="sk-proj"

pre_promt = """This is an ABI, and simulated transaction in starknet network, your task is to provive a very brief summary explaining the results of the transaction execution for a non pro crypto user.
checkcall data have to understand what functions and values are being called
remember this is starknet net, there eth and strk
make it simple to understand
Focus on awnsering, is it transfering funds or not if there are funds transfere how much and token, is giving permits to another address, how much fees are paid, what the tx doing, inserting new data, voting, please keep it very concise max 4 lines, if wei units express them on only on eth converting, name called functions, do not says this or the transaction try to be as short as possible
"""

client = OpenAI(api_key=OPENAI_API_KEY)

def llm_call(query):
    print("processing tx....")
    completion = client.chat.completions.create(
      model="gpt-4o-2024-05-13",
      messages=[
        {"role": "system", "content": "you are a expert system helping people understand transactions part of a wallet interface so keep it short."},
        {"role": "user", "content": query}
      ]
    )

    print(completion.choices[0].message.content)
    return(completion.choices[0].message.content)
