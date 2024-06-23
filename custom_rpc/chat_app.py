import streamlit as st
from query_llm import llm_call, pre_promt

st.header("Tensorfy Chatbot")

if "messages" not in st.session_state:
    st.session_state["messages"] = [
            {
                "role": "assistant",
                "content": "Hello! Input the raw transaction details and I'll explain it clearly."
            }
        ]

for msg in st.session_state.messages:
    st.chat_message(msg["role"]).write(msg["content"])

if prompt := st.chat_input():
    st.session_state.messages.append(
            {
                "role": "user",
                "content": prompt
            })
    st.chat_message("user").write(prompt)

    context = "Context : \n\n" + str(st.session_state.messages)
    response = llm_call(context + pre_promt + prompt)

    message = {
            "role": "assistant",
            "content": response
        }
    st.session_state.messages.append(message)
    st.chat_message("assistant").write(message["content"])
