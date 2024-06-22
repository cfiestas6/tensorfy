from openai import OpenAI

OPENAI_API_KEY="sk-proj-"


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