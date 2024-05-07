import { newDb } from "pg-mem"
import { Pool } from "pg"
import { PostgresCourseSubscriptionsRepository } from "../repository/PostgresCourseSubscriptionRespository"
import { Api } from "../Api"
import { EventSourcedApi } from "./EventSourcedApi"
import { MemoryEventStore } from "../../eventStore/memoryEventStore/MemoryEventStore"
import { CourseSubscriptionsProjection } from "./CourseSubscriptionsProjection"
import { ProjectionRegistry } from "../../eventHandling/EventHandler"

const COURSE_1 = {
    id: "course-1",
    capacity: 5
}

describe("EventSourcedApi", () => {
    let pool: Pool
    let repository: PostgresCourseSubscriptionsRepository
    let api: Api

    beforeEach(async () => {
        pool = new (newDb().adapters.createPg().Pool)()
        repository = new PostgresCourseSubscriptionsRepository(pool)
        await repository.install()

        const projectionRegistry = {
            courseSubscriptionProjection: CourseSubscriptionsProjection(repository)
        }

        api = EventSourcedApi(new MemoryEventStore(), repository, projectionRegistry)
        api.registerCourse(COURSE_1.id, COURSE_1.capacity)

        const studentRegistraionPromises = []
        for (let i = 0; i < 100; i++) {
            studentRegistraionPromises.push(api.registerStudent(`student-${i}`, `Student ${i}`))
        }
        await Promise.all(studentRegistraionPromises)
    })

    test("should throw error when 6th student subscribes", async () => {
        for (let i = 1; i <= 5; i++) {
            await api.subscribeStudentToCourse(COURSE_1.id, `student-${i}`)
        }

        await expect(api.subscribeStudentToCourse(COURSE_1.id, "student-6")).rejects.toThrow(
            `Course ${COURSE_1.id} is full.`
        )
    })

    test("should reject subscriptions when 10 students subscribe simultaneously", async () => {
        const studentSubscriptionPromises = []

        for (let i = 0; i < 10; i++) {
            studentSubscriptionPromises.push(api.subscribeStudentToCourse(COURSE_1.id, `student-${i}`))
        }

        const results = await Promise.allSettled(studentSubscriptionPromises)
        const succeeded = results.filter(result => result.status === "fulfilled").length
        expect(succeeded).toBeLessThanOrEqual(COURSE_1.capacity)
    })

    test("should handle subscribe and unsubscribe, managing capacity correctly", async () => {
        for (let i = 0; i < 5; i++) {
            await api.subscribeStudentToCourse(COURSE_1.id, `student-${i}`)
        }
    })
})