import { EventHandlerWithState } from "../../eventHandling/EventHandlerWithState"
import {
    CourseWasRegisteredEvent,
    CourseCapacityWasChangedEvent,
    StudentWasSubscribedEvent,
    StudentWasUnsubscribedEvent,
    StudentWasRegistered
} from "./Events"

export const CourseCapacity = (
    courseId: string
): EventHandlerWithState<{
    state: { subscriberCount: number; capacity: number }
    eventHandlers:
        | CourseWasRegisteredEvent
        | CourseCapacityWasChangedEvent
        | StudentWasSubscribedEvent
        | StudentWasUnsubscribedEvent
}> => ({
    tagFilter: { courseId },
    init: { subscriberCount: 0, capacity: 0 },
    when: {
        courseWasRegistered: ({ event }) => ({
            isFull: event.data.capacity === 0,
            capacity: event.data.capacity,
            subscriberCount: 0
        }),
        courseCapacityWasChanged: ({ event }, { subscriberCount }) => ({
            subscriberCount,
            capacity: event.data.newCapacity
        }),
        studentWasSubscribed: (_eventEnvelope, { capacity, subscriberCount }) => ({
            subscriberCount: subscriberCount + 1,
            capacity
        }),
        studentWasUnsubscribed: (eventEnvelope, { capacity, subscriberCount }) => ({
            subscriberCount: subscriberCount - 1,
            capacity
        })
    }
})

export const CourseExists = (
    courseId: string
): EventHandlerWithState<{
    state: boolean
    tagFilter: { courseId: string }
    eventHandlers: CourseWasRegisteredEvent
}> => ({
    tagFilter: { courseId },
    init: false,
    when: {
        courseWasRegistered: async () => true
    }
})

export const StudentAlreadySubscribed = ({
    courseId,
    studentId
}: {
    courseId: string
    studentId: string
}): EventHandlerWithState<{
    state: boolean
    tagFilter: { courseId: string; studentId: string }
    eventHandlers: StudentWasSubscribedEvent | StudentWasUnsubscribedEvent
}> => ({
    tagFilter: { courseId, studentId },
    init: false,
    when: {
        studentWasSubscribed: () => true,
        studentWasUnsubscribed: () => false
    }
})

export const NextStudentNumber = (): EventHandlerWithState<{
    state: number
    eventHandlers: StudentWasRegistered
}> => ({
    init: 1,
    when: {
        studentWasRegistered: async (event, state) => state + 1
    }
})

export const StudentAlreadyRegistered = (
    studentId: string
): EventHandlerWithState<{
    state: boolean
    tagFilter: { studentId: string }
    eventHandlers: StudentWasRegistered
}> => ({
    tagFilter: { studentId },
    init: false,
    when: {
        studentWasRegistered: async () => true
    }
})

export const StudentSubscriptions = (
    studentId: string
): EventHandlerWithState<{
    state: { subscriptionCount: number }
    eventHandlers: StudentWasSubscribedEvent | StudentWasUnsubscribedEvent
}> => ({
    tagFilter: { studentId },
    init: { subscriptionCount: 0 },
    when: {
        studentWasSubscribed: (_eventEnvelope, { subscriptionCount }) => ({
            subscriptionCount: subscriptionCount + 1
        }),
        studentWasUnsubscribed: (_eventEnvelope, { subscriptionCount }) => ({
            subscriptionCount: subscriptionCount - 1
        })
    }
})
